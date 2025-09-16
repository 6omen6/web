export interface Message {
  id?: number;
  content: string;
  isFromUser: boolean;
  timestamp: Date;
  threadId?: number;
  rating?: number | null;
  userRating?: number | null;
  isGenerating?: boolean;
  wasCancelled?: boolean;
}

export interface SendMessageCommand {
  content: string;
  isFromUser: boolean;
}

export interface RatingRequest {
  messageId: number;
  score: number;
  userId?: string;
}

export interface RatingResponse {
  totalScore: number;
  userRating?: number;
}