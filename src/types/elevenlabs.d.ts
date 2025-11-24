declare module '@elevenlabs/client' {
  export interface ConversationOptions {
    signedUrl: string;
    onModeChange?: (mode: { mode: string }) => void;
    onMessage?: (message: { source: string; message: string }) => void;
    onError?: (error: any) => void;
    onDisconnect?: () => void;
  }

  export interface ConversationInstance {
    getId?: () => string;
    endSession: () => Promise<void>;
  }

  export class Conversation {
    static startSession(options: ConversationOptions): Promise<ConversationInstance>;
  }
}
