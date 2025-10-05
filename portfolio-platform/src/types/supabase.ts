export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      demo_private_data: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      benchmark_data: {
        Row: {
          adjusted_close: number
          benchmark_name: string
          close: number
          created_at: string
          daily_return: number | null
          date: string
          high: number
          id: string
          low: number
          open: number
          source: string
          symbol: string
          updated_at: string
          volume: number
        }
        Insert: {
          adjusted_close: number
          benchmark_name?: string
          close: number
          created_at?: string
          daily_return?: number | null
          date: string
          high: number
          id?: string
          low: number
          open: number
          source?: string
          symbol?: string
          updated_at?: string
          volume: number
        }
        Update: {
          adjusted_close?: number
          benchmark_name?: string
          close?: number
          created_at?: string
          daily_return?: number | null
          date?: string
          high?: number
          id?: string
          low?: number
          open?: number
          source?: string
          symbol?: string
          updated_at?: string
          volume?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          asset_name: string | null
          asset_type: string
          created_at: string
          currency: string
          executed_at: string
          external_id: string | null
          fee: number | null
          id: string
          portfolio_id: string
          price: number
          quantity: number
          source: string
          ticker: string
          total_value: number
          transaction_type: string
          updated_at: string
        }
        Insert: {
          asset_name?: string | null
          asset_type: string
          created_at?: string
          currency: string
          executed_at: string
          external_id?: string | null
          fee?: number | null
          id?: string
          portfolio_id: string
          price: number
          quantity: number
          source: string
          ticker: string
          total_value: number
          transaction_type: string
          updated_at?: string
        }
        Update: {
          asset_name?: string | null
          asset_type?: string
          created_at?: string
          currency?: string
          executed_at?: string
          external_id?: string | null
          fee?: number | null
          id?: string
          portfolio_id?: string
          price?: number
          quantity?: number
          source?: string
          ticker?: string
          total_value?: number
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_portfolio_id_fkey'
            columns: ['portfolio_id']
            isOneToOne: false
            referencedRelation: 'portfolios'
            referencedColumns: ['id']
          },
        ]
      }
      investments: {
        Row: {
          average_cost: number
          created_at: string
          current_price: number | null
          id: string
          name: string
          notes: string | null
          quantity: number
          symbol: string
          type: Database['public']['Enums']['investment_type']
          updated_at: string
          user_id: string
        }
        Insert: {
          average_cost?: number
          created_at?: string
          current_price?: number | null
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          symbol: string
          type: Database['public']['Enums']['investment_type']
          updated_at?: string
          user_id: string
        }
        Update: {
          average_cost?: number
          created_at?: string
          current_price?: number | null
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          symbol?: string
          type?: Database['public']['Enums']['investment_type']
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'investments_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      crypto: {
        Row: {
          asset_code: string
          average_cost: number | null
          created_at: string
          current_price: number | null
          gain_loss: number | null
          gain_loss_pct: number | null
          id: string
          last_synced_at: string | null
          market_value: number | null
          name: string | null
          portfolio_id: string
          quantity: number
          symbol: string
          updated_at: string
        }
        Insert: {
          asset_code: string
          average_cost?: number | null
          created_at?: string
          current_price?: number | null
          gain_loss?: number | null
          gain_loss_pct?: number | null
          id?: string
          last_synced_at?: string | null
          market_value?: number | null
          name?: string | null
          portfolio_id: string
          quantity: number
          symbol: string
          updated_at?: string
        }
        Update: {
          asset_code?: string
          average_cost?: number | null
          created_at?: string
          current_price?: number | null
          gain_loss?: number | null
          gain_loss_pct?: number | null
          id?: string
          last_synced_at?: string | null
          market_value?: number | null
          name?: string | null
          portfolio_id?: string
          quantity?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'crypto_portfolio_id_fkey'
            columns: ['portfolio_id']
            isOneToOne: false
            referencedRelation: 'portfolios'
            referencedColumns: ['id']
          },
        ]
      }
      crypto_history: {
        Row: {
          created_at: string
          crypto_id: string
          gain_loss: number | null
          gain_loss_pct: number | null
          id: string
          market_value: number
          price: number
          quantity: number
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          crypto_id: string
          gain_loss?: number | null
          gain_loss_pct?: number | null
          id?: string
          market_value: number
          price: number
          quantity: number
          snapshot_date: string
        }
        Update: {
          created_at?: string
          crypto_id?: string
          gain_loss?: number | null
          gain_loss_pct?: number | null
          id?: string
          market_value?: number
          price?: number
          quantity?: number
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: 'crypto_history_crypto_id_fkey'
            columns: ['crypto_id']
            isOneToOne: false
            referencedRelation: 'crypto'
            referencedColumns: ['id']
          },
        ]
      }
      portfolio_snapshots: {
        Row: {
          cash_balance: number | null
          created_at: string
          id: string
          portfolio_id: string
          snapshot_date: string
          snapshot_type: string
          total_cost_basis: number | null
          total_gain_loss: number | null
          total_return_pct: number | null
          total_value: number
        }
        Insert: {
          cash_balance?: number | null
          created_at?: string
          id?: string
          portfolio_id: string
          snapshot_date: string
          snapshot_type?: string
          total_cost_basis?: number | null
          total_gain_loss?: number | null
          total_return_pct?: number | null
          total_value: number
        }
        Update: {
          cash_balance?: number | null
          created_at?: string
          id?: string
          portfolio_id?: string
          snapshot_date?: string
          snapshot_type?: string
          total_cost_basis?: number | null
          total_gain_loss?: number | null
          total_return_pct?: number | null
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: 'portfolio_snapshots_portfolio_id_fkey'
            columns: ['portfolio_id']
            isOneToOne: false
            referencedRelation: 'portfolios'
            referencedColumns: ['id']
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string
          full_name: string | null
          github_url: string | null
          id: string
          linkedin_url: string | null
          location: string | null
          resume_url: string | null
          twitter_url: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          github_url?: string | null
          id: string
          linkedin_url?: string | null
          location?: string | null
          resume_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          github_url?: string | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          resume_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      project_links: {
        Row: {
          created_at: string
          id: string
          label: string | null
          project_id: string
          type: Database['public']['Enums']['project_link_type']
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          project_id: string
          type: Database['public']['Enums']['project_link_type']
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          project_id?: string
          type?: Database['public']['Enums']['project_link_type']
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_links_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      project_tags: {
        Row: {
          created_at: string
          id: string
          project_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          tag: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_tags_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      project_tech_stack: {
        Row: {
          category: string | null
          created_at: string
          id: string
          project_id: string
          technology: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          project_id: string
          technology: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          project_id?: string
          technology?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_tech_stack_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      projects: {
        Row: {
          content: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          end_date: string | null
          featured: boolean
          id: string
          slug: string
          start_date: string | null
          status: Database['public']['Enums']['project_status']
          title: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          featured?: boolean
          id?: string
          slug: string
          start_date?: string | null
          status?: Database['public']['Enums']['project_status']
          title: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          featured?: boolean
          id?: string
          slug?: string
          start_date?: string | null
          status?: Database['public']['Enums']['project_status']
          title?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'projects_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      stock_history: {
        Row: {
          created_at: string
          gain_loss: number | null
          gain_loss_pct: number | null
          id: string
          market_value: number
          price: number
          quantity: number
          snapshot_date: string
          stock_id: string
        }
        Insert: {
          created_at?: string
          gain_loss?: number | null
          gain_loss_pct?: number | null
          id?: string
          market_value: number
          price: number
          quantity: number
          snapshot_date: string
          stock_id: string
        }
        Update: {
          created_at?: string
          gain_loss?: number | null
          gain_loss_pct?: number | null
          id?: string
          market_value?: number
          price?: number
          quantity?: number
          snapshot_date?: string
          stock_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stock_history_stock_id_fkey'
            columns: ['stock_id']
            isOneToOne: false
            referencedRelation: 'stocks'
            referencedColumns: ['id']
          },
        ]
      }
      stocks: {
        Row: {
          asset_type: string
          average_cost: number | null
          country: string | null
          created_at: string
          currency: string | null
          current_price: number | null
          custom_group: string | null
          custom_tags: string[] | null
          exchange: string | null
          gain_loss: number | null
          gain_loss_pct: number | null
          id: string
          industry: string | null
          initial_fill_date: string | null
          isin: string | null
          last_synced_at: string | null
          market_value: number | null
          name: string
          portfolio_id: string
          quantity: number
          region: string | null
          sector: string | null
          ticker: string
          updated_at: string
        }
        Insert: {
          asset_type: string
          average_cost?: number | null
          country?: string | null
          created_at?: string
          currency?: string | null
          current_price?: number | null
          custom_group?: string | null
          custom_tags?: string[] | null
          exchange?: string | null
          gain_loss?: number | null
          gain_loss_pct?: number | null
          id?: string
          industry?: string | null
          initial_fill_date?: string | null
          isin?: string | null
          last_synced_at?: string | null
          market_value?: number | null
          name: string
          portfolio_id: string
          quantity: number
          region?: string | null
          sector?: string | null
          ticker: string
          updated_at?: string
        }
        Update: {
          asset_type?: string
          average_cost?: number | null
          country?: string | null
          created_at?: string
          currency?: string | null
          current_price?: number | null
          custom_group?: string | null
          custom_tags?: string[] | null
          exchange?: string | null
          gain_loss?: number | null
          gain_loss_pct?: number | null
          id?: string
          industry?: string | null
          initial_fill_date?: string | null
          isin?: string | null
          last_synced_at?: string | null
          market_value?: number | null
          name?: string
          portfolio_id?: string
          quantity?: number
          region?: string | null
          sector?: string | null
          ticker?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stocks_portfolio_id_fkey'
            columns: ['portfolio_id']
            isOneToOne: false
            referencedRelation: 'portfolios'
            referencedColumns: ['id']
          },
        ]
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          portfolio_id: string
          records_failed: number | null
          records_synced: number | null
          source: string
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          portfolio_id: string
          records_failed?: number | null
          records_synced?: number | null
          source: string
          started_at?: string
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          portfolio_id?: string
          records_failed?: number | null
          records_synced?: number | null
          source?: string
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sync_logs_portfolio_id_fkey'
            columns: ['portfolio_id']
            isOneToOne: false
            referencedRelation: 'portfolios'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      investment_type: 'stock' | 'crypto' | 'etf' | 'bond' | 'real_estate' | 'other'
      project_link_type: 'github' | 'demo' | 'website' | 'other'
      project_status: 'draft' | 'published' | 'archived'
      transaction_type: 'buy' | 'sell' | 'dividend' | 'fee'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      investment_type: ['stock', 'crypto', 'etf', 'bond', 'real_estate', 'other'],
      project_link_type: ['github', 'demo', 'website', 'other'],
      project_status: ['draft', 'published', 'archived'],
      transaction_type: ['buy', 'sell', 'dividend', 'fee'],
    },
  },
} as const
