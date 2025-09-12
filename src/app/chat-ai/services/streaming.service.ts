import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface StreamingResponse {
  text: string;
  isCompleted: boolean;
  threadId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class StreamingService {
  private apiUrl = '/api/streaming/generate';
  private abortController = new AbortController();
  private stopStream$ = new Subject<void>();
  private lastResponseText = '';
  
  constructor(private http: HttpClient) {}

  generateStreamingResponse(userMessage: string, threadId?: number): Observable<StreamingResponse> {
    this.abortController = new AbortController();
    
    this.stopStream$ = new Subject<void>();
    
    this.lastResponseText = '';
    
    const responseSubject = new Subject<StreamingResponse>();
    
    let url = `${this.apiUrl}?userMessage=${encodeURIComponent(userMessage)}`;
    if (threadId) {
      url += `&threadId=${threadId}`;
    }
      
    const eventSource = new EventSource(url);
    
    eventSource.onmessage = (event) => {
      this.lastResponseText = event.data;
      responseSubject.next({ 
        text: event.data, 
        isCompleted: false,
        threadId: threadId
      });
    };
    
    eventSource.onerror = (error) => {
      eventSource.close();
      responseSubject.error(error);
    };
    
    eventSource.addEventListener('completed', (event: any) => {
      try {
        const data = JSON.parse(event.data || '{}');
        if (data.threadId) {
          threadId = data.threadId;
        }
      } catch (e) {
        console.error('Error while parsing JSON response:', e);
      }
      
      responseSubject.next({ 
        text: this.lastResponseText, 
        isCompleted: true,
        threadId: threadId
      });
      eventSource.close();
      responseSubject.complete();
    });
    
    eventSource.addEventListener('cancelled', () => {
      responseSubject.next({ 
        text: this.lastResponseText, 
        isCompleted: true,
        threadId: threadId
      });
      eventSource.close();
      responseSubject.complete();
    });
    
    this.stopStream$.subscribe(() => {
      eventSource.close();
      responseSubject.complete();
    });
    
    return responseSubject.asObservable().pipe(
      takeUntil(this.stopStream$)
    );
  }
  
  cancelGeneration(): void {
    this.abortController.abort();
    this.stopStream$.next();
    this.stopStream$.complete();
  }
}