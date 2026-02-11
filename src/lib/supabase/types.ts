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
      user_api_keys: {
        Row: {
          id: number;
          user_id: string;
          platform: string;
          api_key_id: string;
          api_secret: string;
          private_key_pem: string;
          is_valid: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          platform: string;
          api_key_id?: string;
          api_secret?: string;
          private_key_pem?: string;
          is_valid?: boolean;
        };
        Update: {
          api_key_id?: string;
          api_secret?: string;
          private_key_pem?: string;
          is_valid?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
