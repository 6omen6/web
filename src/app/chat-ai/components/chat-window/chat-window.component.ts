import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../services/chat-ai.services';
import { Message } from '../../models/message';
import { StreamingService } from '../../services/streaming.service';
import { Subscription } from 'rxjs';
import { ConversationThread } from '../../models/thread';
import { ThreadListComponent } from '../thread-list/thread-list.component';

import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MessageRatingComponent } from '../message-rating/message-rating.component';

@Component({
  selector: 'app-chat-window',
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    MatCardModule,
    MatToolbarModule,
    MatListModule,
    ThreadListComponent,
    MessageRatingComponent
  ]
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  messages: Message[] = [];
  messageInput = new FormControl('', [Validators.required]);
  isLoading = false;
  isGenerating = false;
  currentThread: ConversationThread | null = null;
  
  private streamSubscription?: Subscription;
  private messagesSubscription?: Subscription;
  private threadSubscription?: Subscription;
  private currentGeneratingMessage?: Message;

  constructor(
    private chatService: ChatService,
    private streamingService: StreamingService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.threadSubscription = this.chatService.currentThread$.subscribe(thread => {
      this.currentThread = thread;
    });

    this.messagesSubscription = this.chatService.messages$.subscribe(messages => {
      this.messages = messages;
      this.scrollToBottom();
    });
  }
  
  ngOnDestroy(): void {
    this.cancelGeneration();
    if (this.streamSubscription) {
      this.streamSubscription.unsubscribe();
    }
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
    if (this.threadSubscription) {
      this.threadSubscription.unsubscribe();
    }
  }

  loadMessages(): void {
    this.isLoading = true;
    
    if (this.currentThread) {
      this.chatService.getThreadMessages(this.currentThread.id).subscribe({
        error: (error) => {
          console.error('Error while fetching thread messages:', error);
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
        }
      });
    } else {
      this.chatService.getMessages().subscribe({
        error: (error) => {
          console.error('Error while fetching messages:', error);
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
        }
      });
    }
  }

  sendMessage(): void {
    if (this.messageInput.invalid || this.isLoading || this.isGenerating) {
      return;
    }

    const content = this.messageInput.value?.trim();
    if (!content) {
      return;
    }
    
    this.messageInput.reset();
    
    this.startStreamingResponse(content);
  }

  startStreamingResponse(userContent: string): void {
    this.isGenerating = true;
    
    const userMessage: Message = {
      content: userContent,
      isFromUser: true,
      timestamp: new Date()
    };
    
    const aiMessage: Message = {
      content: '',
      isFromUser: false,
      timestamp: new Date(),
      isGenerating: true
    };
    
    this.messages.push(userMessage);
    this.messages.push(aiMessage);
    this.currentGeneratingMessage = aiMessage;
    this.scrollToBottom();
      
    const threadId = this.currentThread?.id;
    
    this.streamSubscription = this.streamingService.generateStreamingResponse(userContent, threadId)
      .subscribe({
        next: (response) => {
          if (this.currentGeneratingMessage) {
            this.ngZone.run(() => {
              if (this.currentGeneratingMessage) {
                this.currentGeneratingMessage.content = response.text;

                if (response.messageId) {
                  this.currentGeneratingMessage.id = response.messageId;
                }
                
                if (response.wasCancelled) {
                  this.currentGeneratingMessage.wasCancelled = true;
                  this.currentGeneratingMessage.isGenerating = false;
                }
                
                this.messages = [...this.messages];
                
                if (response.isCompleted) {
                  this.finishGeneration(true);
                  
                  if (response.threadId && (!this.currentThread || this.currentThread.id !== response.threadId)) {
                    this.chatService.getThreads().subscribe(threads => {
                      const thread = threads.find((t: ConversationThread) => t.id === response.threadId);
                      if (thread) {
                        this.chatService.setCurrentThread(thread);
                      }
                    });
                  }
                }
                
                this.scrollToBottom();
              }
            });
          }
        },
        error: (error) => {
          console.error('Error during streaming:', error);
          this.finishGeneration(false);
        },
      });
  }
  
cancelGeneration(): void {
  if (!this.isGenerating) return;
  
  this.streamingService.cancelGeneration(false);
  
  if (this.currentGeneratingMessage) {
    this.currentGeneratingMessage.wasCancelled = true;
    
    this.ngZone.run(() => {
      this.messages = [...this.messages]; 
    });
  }
  }
  
  finishGeneration(success: boolean): void {
    if (this.streamSubscription) {
      this.streamSubscription.unsubscribe();
      this.streamSubscription = undefined;
    }
    
    if (this.currentGeneratingMessage) {
      this.currentGeneratingMessage.isGenerating = false;
      
      if (!success && !this.currentGeneratingMessage.content) {
        this.messages = this.messages.filter(m => m !== this.currentGeneratingMessage);
      }
      
      this.currentGeneratingMessage = undefined;
    }
    
    this.isGenerating = false;
    
    this.ngZone.run(() => {
      this.messages = [...this.messages];
    });
    
    this.scrollToBottom();
  }
  
  createNewThread(): void {
    this.chatService.createThread().subscribe();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const chatContainer = document.querySelector('.chat-messages');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }
}