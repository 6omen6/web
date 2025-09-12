export interface ConversationThread {
  id: number;
  title: string;
  createdAt: Date;
  updatedAt?: Date;
  isActive: boolean;
}