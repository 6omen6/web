import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface StreamingResponse {
  text: string;
  isCompleted: boolean;
  threadId?: number;
  messageId?: number;
  wasCancelled?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class StreamingService {
  private apiUrl = '/api/streaming/generate';
  private abortController = new AbortController();
  private stopStream$ = new Subject<void>();
  private lastResponseText = '';
  private currentEventSource: EventSource | null = null;
  private cancellationInProgress = false;
  private currentRequestId: string | null = null;
  
  constructor(private http: HttpClient) {}

  generateStreamingResponse(userMessage: string, threadId?: number): Observable<StreamingResponse> {
    if (!this.cancellationInProgress) {
      this.cancelGeneration(true);
    }
    
    this.abortController = new AbortController();
    this.stopStream$ = new Subject<void>();
    this.lastResponseText = '';
    this.cancellationInProgress = false;
    
    this.currentRequestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const responseSubject = new Subject<StreamingResponse>();
    
    let url = `${this.apiUrl}?userMessage=${encodeURIComponent(userMessage)}&requestId=${this.currentRequestId}`;
    if (threadId) {
      url += `&threadId=${threadId}`;
    }
    
    this.currentEventSource = new EventSource(url);
    
    this.currentEventSource.onmessage = (event) => {
      this.lastResponseText = event.data;
      responseSubject.next({ 
        text: event.data, 
        isCompleted: false,
        threadId: threadId
      });
    };
    
    this.currentEventSource.onerror = (error) => {
      this.closeEventSource();
      responseSubject.error(error);
    };
    
    this.currentEventSource.addEventListener('completed', (event: any) => {
      let messageId: number | undefined = undefined;
      let wasCancelled: boolean = false;

      console.log('Received completed event:', event);
      
      try {
        const data = JSON.parse(event.data || '{}');
        if (data.threadId) {
          threadId = data.threadId;
        }
        if (data.aiMessageId) {
          messageId = data.aiMessageId;
        }
        if (data.wasCancelled !== undefined) {
          wasCancelled = data.wasCancelled;
        }
      } catch (e) {
        console.error('Error while parsing JSON response:', e);
      }
      
      responseSubject.next({ 
        text: this.lastResponseText, 
        isCompleted: true,
        threadId: threadId,
        messageId: messageId,
        wasCancelled: wasCancelled
      });
      
      this.closeEventSource();
      this.cancellationInProgress = false;
      responseSubject.complete();
    });
    
    return responseSubject.asObservable().pipe(
      takeUntil(this.stopStream$)
    );
  }
  
  cancelGeneration(forceClose = false): void {
    if (!this.currentRequestId && !forceClose) return;
    
    if (forceClose) {
      this.closeEventSource();
    } else {
      this.cancellationInProgress = true;
    }
    
    this.abortController.abort();
    
    if (this.currentRequestId) {
      this.sendCancelRequest(this.currentRequestId);
    }
    
    if (forceClose) {
      if (this.stopStream$) {
        this.stopStream$.next();
        this.stopStream$.complete();
      }
      this.currentRequestId = null;
    }
  }
  
  private closeEventSource(): void {
    if (this.currentEventSource) {
      this.currentEventSource.close();
      this.currentEventSource = null;
    }
  }
  
  private sendCancelRequest(requestId: string): void {
    fetch(`/api/streaming/cancel?requestId=${requestId}`, {
      method: 'POST'
    }).catch(err => console.error('Error sending cancel request:', err));
  }
}