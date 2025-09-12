import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChatService } from '../../services/chat-ai.services';

@Component({
  selector: 'app-message-rating',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './message-rating.component.html',
  styleUrls: ['./message-rating.component.scss']
})
export class MessageRatingComponent implements OnChanges {
  @Input() messageId: number | undefined;
  @Input() userRating: number | undefined;
  
  private _currentRating: number | undefined;
  
  constructor(private chatService: ChatService) {}
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userRating']) {
      this._currentRating = this.userRating;
    }
  }
  
  rate(score: number): void {
    if (!this.messageId) return;
    
    const finalScore = this._currentRating === score ? 0 : score;
    
    this._currentRating = finalScore !== 0 ? finalScore : undefined;
    this.userRating = this._currentRating;
    
    this.chatService.rateMessage(this.messageId, finalScore).subscribe({
      next: (response) => {
        this._currentRating = response.userRating;
        this.userRating = response.userRating;
      },
      error: () => {
        console.error('Error while rating the message');
        this._currentRating = undefined;
        this.userRating = undefined;
      }
    });
  }
}