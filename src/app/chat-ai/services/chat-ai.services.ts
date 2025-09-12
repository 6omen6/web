import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Message, RatingRequest, RatingResponse } from '../models/message';
import { ConversationThread } from '../models/thread';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = '/api/message';
  private threadsUrl = '/api/thread';
  private ratingUrl = '/api/rating';
  private messageSubject = new BehaviorSubject<Message[]>([]);
  private threadSubject = new BehaviorSubject<ConversationThread[]>([]);
  private currentThreadSubject = new BehaviorSubject<ConversationThread | null>(null);
  
  private currentUserId = 'user-' + Math.random().toString(36).substr(2, 9);
  
  public messages$ = this.messageSubject.asObservable();
  public threads$ = this.threadSubject.asObservable();
  public currentThread$ = this.currentThreadSubject.asObservable();

  private messages: Message[] = [];
  private threads: ConversationThread[] = [];
  
  constructor(private http: HttpClient) { 
    this.loadThreads();
  }

  getMessages(): Observable<Message[]> {
    return this.http.get<Message[]>(this.apiUrl)
      .pipe(
        tap(messages => {
          this.messages = messages;
          this.messageSubject.next(messages);
        })
      );
  }

  getThreadMessages(threadId: number): Observable<Message[]> {
    const userId = this.currentUserId;
    return this.http.get<Message[]>(`${this.threadsUrl}/${threadId}/messages?userId=${userId}`)
      .pipe(
        tap(messages => {
          this.messages = messages;
          this.messageSubject.next(messages);
        })
      );
  }

  sendMessage(content: string, isFromUser: boolean, threadId?: number): Observable<Message> {
    const message = { content, isFromUser, threadId };
    return this.http.post<Message>(this.apiUrl, message);
  }
  
rateMessage(messageId: number, score: number): Observable<RatingResponse> {
  const ratingRequest: RatingRequest = {
    messageId,
    score,
    userId: this.currentUserId
  };
  
  return this.http.post<RatingResponse>(this.ratingUrl, ratingRequest)
    .pipe(
      tap(response => {
        const messageIndex = this.messages.findIndex(m => m.id === messageId);
        if (messageIndex >= 0) {
          const updatedMessage = { 
            ...this.messages[messageIndex],
            rating: response.totalScore,
            userRating: response.userRating
          };
          
          const updatedMessages = [...this.messages];
          updatedMessages[messageIndex] = updatedMessage;
          
          this.messages = updatedMessages;
          this.messageSubject.next(updatedMessages);
        }
      })
    );
}
  getMessageRating(messageId: number): Observable<RatingResponse> {
    return this.http.get<RatingResponse>(`${this.ratingUrl}/${messageId}?userId=${this.currentUserId}`)
      .pipe(
        tap(response => {
          const messageIndex = this.messages.findIndex(m => m.id === messageId);
          if (messageIndex >= 0) {
            this.messages[messageIndex] = {
              ...this.messages[messageIndex],
              rating: response.totalScore,
              userRating: response.userRating
            };
            this.messageSubject.next([...this.messages]);
          }
        })
      );
  }


  loadThreads(): void {
    this.http.get<ConversationThread[]>(`${this.threadsUrl}?userId=${this.currentUserId}`)
      .subscribe({
        next: (threads) => {
          this.threads = threads;
          this.threadSubject.next(threads);
          
          const activeThread = threads.find(t => t.isActive);
          if (activeThread) {
            this.setCurrentThread(activeThread);
          }
        },
        error: (error) => console.error('Error while fetching threads:', error)
      });
  }

  getThreads(): Observable<ConversationThread[]> {
    return this.http.get<ConversationThread[]>(`${this.threadsUrl}?userId=${this.currentUserId}`)
      .pipe(
        tap(threads => {
          this.threads = threads;
          this.threadSubject.next(threads);
        })
      );
  }

  createThread(title: string = 'Nowa konwersacja'): Observable<ConversationThread> {
    return this.http.post<ConversationThread>(this.threadsUrl, { 
      title, 
      userId: this.currentUserId 
    })
    .pipe(
      tap(newThread => {
        this.threads.push(newThread);
        this.threadSubject.next([...this.threads]);
        this.setCurrentThread(newThread);
      })
    );
  }

  updateThreadTitle(threadId: number, title: string): Observable<ConversationThread> {
    return this.http.put<ConversationThread>(`${this.threadsUrl}/${threadId}`, { title })
      .pipe(
        tap(updatedThread => {
          const index = this.threads.findIndex(t => t.id === updatedThread.id);
          if (index !== -1) {
            this.threads[index] = updatedThread;
            this.threadSubject.next([...this.threads]);
            
            if (this.currentThreadSubject.value?.id === updatedThread.id) {
              this.currentThreadSubject.next(updatedThread);
            }
          }
        })
      );
  }

  setCurrentThread(thread: ConversationThread | null): void {
    if (thread) {
      this.messages = [];
      this.messageSubject.next([]);

      this.currentThreadSubject.next(thread);
      this.getThreadMessages(thread.id).subscribe();

      this.updateThreadActivity(thread.id, true).subscribe({
        error: (error) => console.error('Error while updating thread activity:', error)
      });
    } else {
      this.currentThreadSubject.next(null);
      this.messages = [];
      this.messageSubject.next([]);
    }
  }
  
  getCurrentUserId(): string {
    return this.currentUserId;
  }

  updateThreadActivity(threadId: number, isActive: boolean): Observable<ConversationThread> {
  return this.http.put<ConversationThread>(`${this.threadsUrl}/${threadId}/activity`, { isActive })
    .pipe(
      tap(updatedThread => {
        const index = this.threads.findIndex(t => t.id === updatedThread.id);
        if (index !== -1) {
          this.threads[index] = updatedThread;
          this.threadSubject.next([...this.threads]);
        }
      })
    );
}
}