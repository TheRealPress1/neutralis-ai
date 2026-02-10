export type Database = {
  public: {
    Tables: {
      waitlist: {
        Row: {
          id: number;
          email: string;
          created_at: string;
        };
        Insert: {
          email: string;
        };
        Update: {
          email?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
