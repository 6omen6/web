import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat-ai.services';
import { ConversationThread } from '../../models/thread';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list'; 
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'app-thread-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatListModule, 
    MatInputModule,
    MatFormFieldModule,
    MatToolbarModule
  ],
  templateUrl: './thread-list.component.html',
  styleUrls: ['./thread-list.component.scss']
})
export class ThreadListComponent implements OnInit, AfterViewChecked {
  threads: ConversationThread[] = [];
  currentThread: ConversationThread | null = null;
  isEditing: { [key: number]: boolean } = {};
  editTitle: { [key: number]: string } = {};
  
  @ViewChild('titleInput') titleInput: ElementRef | undefined;
  
  constructor(private chatService: ChatService) { }

  ngOnInit(): void {
    this.chatService.threads$.subscribe(threads => {
      this.threads = threads;
    });
    
    this.chatService.currentThread$.subscribe(thread => {
      this.currentThread = thread;
    });
    
    this.chatService.getThreads().subscribe();
  }

  ngAfterViewChecked() {
    if (this.titleInput && Object.values(this.isEditing).some(val => val)) {
      this.titleInput.nativeElement.focus();
    }
  }

  createNewThread(): void {
    this.chatService.createThread('Nowa konwersacja').subscribe({
      next: () => {
      },
      error: (err) => console.error('Error while creating thread:', err)
    });
  }

  selectThread(thread: ConversationThread): void {
    Object.keys(this.isEditing).forEach(key => {
      this.isEditing[parseInt(key)] = false;
    });
    
    this.chatService.setCurrentThread(thread);
  }

  startEditing(thread: ConversationThread): void {
    Object.keys(this.isEditing).forEach(key => {
      this.isEditing[parseInt(key)] = false;
    });
    
    this.isEditing[thread.id] = true;
    this.editTitle[thread.id] = thread.title;
  }

  saveTitle(thread: ConversationThread): void {
    if (this.editTitle[thread.id]?.trim()) {
      this.chatService.updateThreadTitle(thread.id, this.editTitle[thread.id]).subscribe({
        next: () => {
          this.isEditing[thread.id] = false;
        },
        error: (err) => console.error('Error while updating thread title:', err)
      });
    } else {
      this.cancelEditing(thread.id);
    }
  }

  cancelEditing(threadId: number): void {
    this.isEditing[threadId] = false;
  }
  
  formatDate(date: Date | string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }
}