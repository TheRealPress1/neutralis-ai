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
          updated_at: string;
        };
        Insert: {
          user_id: string;
          platform: string;
          api_key_id: string;
          api_secret?: string;
          private_key_pem?: string;
          is_valid?: boolean;
        };
        Update: {
          user_id?: string;
          platform?: string;
          api_key_id?: string;
          api_secret?: string;
          private_key_pem?: string;
          is_valid?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
        };
        Update: {
          email?: string;
          full_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      risk_profiles: {
        Row: {
          id: number;
          name: string;
          preset: string;
          is_active: boolean;
          target_annual_return_pct: number;
          description: string;
          min_edge_pct: number;
          min_liquidity_dollars: number;
          max_time_to_expiry_hours: number;
          min_time_to_expiry_hours: number;
          fee_rate: number;
          max_position_dollars: number;
          max_total_exposure_dollars: number;
          max_event_exposure_dollars: number;
          max_ticker_exposure_dollars: number;
          max_venue_exposure_pct: number;
          max_open_positions: number;
          min_similarity: number;
          category_overrides: Record<string, unknown> | null;
          strategy: string | null;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
