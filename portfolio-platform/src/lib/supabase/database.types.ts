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
      alert_logs: {
        Row: {
          alert_id: string | null
          alert_type: string
          id: string
          message: string
          target_value: number
          ticker: string
          triggered_at: string
          triggered_value: number
        }
        Insert: {
          alert_id?: string | null
          alert_type: string
          id?: string
          message: string
          target_value: number
          ticker: string
          triggered_at?: string
          triggered_value: number
        }
        Update: {
          alert_id?: string | null
          alert_type?: string
          id?: string
          message?: string
          target_value?: number
          ticker?: string
          triggered_at?: string
          triggered_value?: number
        }
        Relationships: [
          {
            foreignKeyName: 'alert_logs_alert_id_fkey'
            columns: ['alert_id']
            isOneToOne: false
            referencedRelation: 'price_alerts'
            referencedColumns: ['id']
          },
        ]
      }
      anomaly_detection_config: {
        Row: {
          config_key: string
          config_value: number
          description: string | null
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: number
          description?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: number
          description?: string | null
          id?: string
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
      custom_regions: {
        Row: {
          countries: string[]
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          countries: string[]
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          countries?: string[]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      etf_asset_allocation: {
        Row: {
          asset_class: string
          created_at: string
          etf_ticker: string
          id: string
          last_updated_at: string
          updated_at: string
          weight_pct: number
        }
        Insert: {
          asset_class: string
          created_at?: string
          etf_ticker: string
          id?: string
          last_updated_at?: string
          updated_at?: string
          weight_pct: number
        }
        Update: {
          asset_class?: string
          created_at?: string
          etf_ticker?: string
          id?: string
          last_updated_at?: string
          updated_at?: string
          weight_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: 'etf_asset_allocation_etf_ticker_fkey'
            columns: ['etf_ticker']
            isOneToOne: false
            referencedRelation: 'etf_metadata'
            referencedColumns: ['ticker']
          },
          {
            foreignKeyName: 'etf_asset_allocation_etf_ticker_fkey'
            columns: ['etf_ticker']
            isOneToOne: false
            referencedRelation: 'etf_stale_data'
            referencedColumns: ['ticker']
          },
        ]
      }
      etf_country_breakdown: {
        Row: {
          country: string
          created_at: string
          etf_ticker: string
          id: string
          last_updated_at: string
          updated_at: string
          weight_pct: number
        }
        Insert: {
          country: string
          created_at?: string
          etf_ticker: string
          id?: string
          last_updated_at?: string
          updated_at?: string
          weight_pct: number
        }
        Update: {
          country?: string
          created_at?: string
          etf_ticker?: string
          id?: string
          last_updated_at?: string
          updated_at?: string
          weight_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: 'etf_country_breakdown_etf_ticker_fkey'
            columns: ['etf_ticker']
            isOneToOne: false
            referencedRelation: 'etf_metadata'
            referencedColumns: ['ticker']
          },
          {
            foreignKeyName: 'etf_country_breakdown_etf_ticker_fkey'
            columns: ['etf_ticker']
            isOneToOne: false
            referencedRelation: 'etf_stale_data'
            referencedColumns: ['ticker']
          },
        ]
      }
      etf_holdings: {
        Row: {
          asset_type: string | null
          country: string | null
          created_at: string
          etf_ticker: string
          holding_isin: string | null
          holding_name: string
          holding_ticker: string | null
          id: string
          industry: string | null
          last_updated_at: string
          market_value_usd: number | null
          sector: string | null
          shares: number | null
          updated_at: string
          weight_pct: number
        }
        Insert: {
          asset_type?: string | null
          country?: string | null
          created_at?: string
          etf_ticker: string
          holding_isin?: string | null
          holding_name: string
          holding_ticker?: string | null
          id?: string
          industry?: string | null
          last_updated_at?: string
          market_value_usd?: number | null
          sector?: string | null
          shares?: number | null
          updated_at?: string
          weight_pct: number
        }
        Update: {
          asset_type?: string | null
          country?: string | null
          created_at?: string
          etf_ticker?: string
          holding_isin?: string | null
          holding_name?: string
          holding_ticker?: string | null
          id?: string
          industry?: string | null
          last_updated_at?: string
          market_value_usd?: number | null
          sector?: string | null
          shares?: number | null
          updated_at?: string
          weight_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: 'etf_holdings_etf_ticker_fkey'
            columns: ['etf_ticker']
            isOneToOne: false
            referencedRelation: 'etf_metadata'
            referencedColumns: ['ticker']
          },
          {
            foreignKeyName: 'etf_holdings_etf_ticker_fkey'
            columns: ['etf_ticker']
            isOneToOne: false
            referencedRelation: 'etf_stale_data'
            referencedColumns: ['ticker']
          },
        ]
      }
      etf_metadata: {
        Row: {
          created_at: string
          data_source: string | null
          id: string
          isin: string | null
          last_scraped_at: string | null
          name: string
          provider: string | null
          scrape_error: string | null
          scrape_status: string | null
          ter_pct: number | null
          ticker: string
          total_assets_usd: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_source?: string | null
          id?: string
          isin?: string | null
          last_scraped_at?: string | null
          name: string
          provider?: string | null
          scrape_error?: string | null
          scrape_status?: string | null
          ter_pct?: number | null
          ticker: string
          total_assets_usd?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_source?: string | null
          id?: string
          isin?: string | null
          last_scraped_at?: string | null
          name?: string
          provider?: string | null
          scrape_error?: string | null
          scrape_status?: string | null
          ter_pct?: number | null
          ticker?: string
          total_assets_usd?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      etf_sector_breakdown: {
        Row: {
          created_at: string
          etf_ticker: string
          id: string
          industry_group: string | null
          last_updated_at: string
          sector: string
          updated_at: string
          weight_pct: number
        }
        Insert: {
          created_at?: string
          etf_ticker: string
          id?: string
          industry_group?: string | null
          last_updated_at?: string
          sector: string
          updated_at?: string
          weight_pct: number
        }
        Update: {
          created_at?: string
          etf_ticker?: string
          id?: string
          industry_group?: string | null
          last_updated_at?: string
          sector?: string
          updated_at?: string
          weight_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: 'etf_sector_breakdown_etf_ticker_fkey'
            columns: ['etf_ticker']
            isOneToOne: false
            referencedRelation: 'etf_metadata'
            referencedColumns: ['ticker']
          },
          {
            foreignKeyName: 'etf_sector_breakdown_etf_ticker_fkey'
            columns: ['etf_ticker']
            isOneToOne: false
            referencedRelation: 'etf_stale_data'
            referencedColumns: ['ticker']
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
      milestone_logs: {
        Row: {
          achieved_at: string
          achieved_value: number
          id: string
          message: string
          milestone_id: string | null
          milestone_type: string
          target_value: number
          title: string
        }
        Insert: {
          achieved_at?: string
          achieved_value: number
          id?: string
          message: string
          milestone_id?: string | null
          milestone_type: string
          target_value: number
          title: string
        }
        Update: {
          achieved_at?: string
          achieved_value?: number
          id?: string
          message?: string
          milestone_id?: string | null
          milestone_type?: string
          target_value?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: 'milestone_logs_milestone_id_fkey'
            columns: ['milestone_id']
            isOneToOne: false
            referencedRelation: 'portfolio_milestones'
            referencedColumns: ['id']
          },
        ]
      }
      portfolio_insights: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          insights_text: string
          positions_count: number | null
          total_value: number | null
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          insights_text: string
          positions_count?: number | null
          total_value?: number | null
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          insights_text?: string
          positions_count?: number | null
          total_value?: number | null
        }
        Relationships: []
      }
      portfolio_metrics: {
        Row: {
          alpha: number | null
          annualized_return: number | null
          annualized_volatility: number | null
          beta: number | null
          calculated_at: string
          created_at: string
          cvar_95: number | null
          id: string
          irr: number | null
          max_drawdown: number | null
          sharpe_ratio: number | null
          sortino_ratio: number | null
          twr: number | null
          var_95: number | null
          var_99: number | null
        }
        Insert: {
          alpha?: number | null
          annualized_return?: number | null
          annualized_volatility?: number | null
          beta?: number | null
          calculated_at?: string
          created_at?: string
          cvar_95?: number | null
          id?: string
          irr?: number | null
          max_drawdown?: number | null
          sharpe_ratio?: number | null
          sortino_ratio?: number | null
          twr?: number | null
          var_95?: number | null
          var_99?: number | null
        }
        Update: {
          alpha?: number | null
          annualized_return?: number | null
          annualized_volatility?: number | null
          beta?: number | null
          calculated_at?: string
          created_at?: string
          cvar_95?: number | null
          id?: string
          irr?: number | null
          max_drawdown?: number | null
          sharpe_ratio?: number | null
          sortino_ratio?: number | null
          twr?: number | null
          var_95?: number | null
          var_99?: number | null
        }
        Relationships: []
      }
      portfolio_milestones: {
        Row: {
          achieved_at: string | null
          created_at: string
          current_value: number | null
          description: string | null
          id: string
          is_achieved: boolean
          is_active: boolean
          milestone_type: string
          notification_sent: boolean
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string
          current_value?: number | null
          description?: string | null
          id?: string
          is_achieved?: boolean
          is_active?: boolean
          milestone_type: string
          notification_sent?: boolean
          target_value: number
          title: string
          updated_at?: string
        }
        Update: {
          achieved_at?: string | null
          created_at?: string
          current_value?: number | null
          description?: string | null
          id?: string
          is_achieved?: boolean
          is_active?: boolean
          milestone_type?: string
          notification_sent?: boolean
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      position_price_history: {
        Row: {
          id: string
          price: number
          price_change_percent: number | null
          recorded_at: string
          ticker: string
          volume: number | null
        }
        Insert: {
          id?: string
          price: number
          price_change_percent?: number | null
          recorded_at?: string
          ticker: string
          volume?: number | null
        }
        Update: {
          id?: string
          price?: number
          price_change_percent?: number | null
          recorded_at?: string
          ticker?: string
          volume?: number | null
        }
        Relationships: []
      }
      price_alerts: {
        Row: {
          alert_type: string
          created_at: string
          current_value: number | null
          id: string
          is_active: boolean
          is_triggered: boolean
          notes: string | null
          notification_sent: boolean
          target_value: number
          ticker: string
          triggered_at: string | null
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          current_value?: number | null
          id?: string
          is_active?: boolean
          is_triggered?: boolean
          notes?: string | null
          notification_sent?: boolean
          target_value: number
          ticker: string
          triggered_at?: string | null
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          current_value?: number | null
          id?: string
          is_active?: boolean
          is_triggered?: boolean
          notes?: string | null
          notification_sent?: boolean
          target_value?: number
          ticker?: string
          triggered_at?: string | null
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
      volatility_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_type: string
          created_at: string
          detected_at: string
          detected_value: number
          id: string
          is_acknowledged: boolean
          message: string
          severity: string
          threshold_value: number
          ticker: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          alert_type: string
          created_at?: string
          detected_at?: string
          detected_value: number
          id?: string
          is_acknowledged?: boolean
          message: string
          severity: string
          threshold_value: number
          ticker?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string
          detected_at?: string
          detected_value?: number
          id?: string
          is_acknowledged?: boolean
          message?: string
          severity?: string
          threshold_value?: number
          ticker?: string | null
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          added_at: string
          asset_type: string
          id: string
          name: string
          notes: string | null
          target_price: number | null
          ticker: string
        }
        Insert: {
          added_at?: string
          asset_type: string
          id?: string
          name: string
          notes?: string | null
          target_price?: number | null
          ticker: string
        }
        Update: {
          added_at?: string
          asset_type?: string
          id?: string
          name?: string
          notes?: string | null
          target_price?: number | null
          ticker?: string
        }
        Relationships: []
      }
    }
    Views: {
      cron_jobs: {
        Row: {
          active: boolean | null
          command: string | null
          database: string | null
          jobid: number | null
          jobname: string | null
          nodename: string | null
          nodeport: number | null
          schedule: string | null
          username: string | null
        }
        Insert: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Update: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Relationships: []
      }
      etf_stale_data: {
        Row: {
          days_old: number | null
          last_scraped_at: string | null
          name: string | null
          scrape_status: string | null
          ticker: string | null
        }
        Insert: {
          days_old?: never
          last_scraped_at?: string | null
          name?: string | null
          scrape_status?: string | null
          ticker?: string | null
        }
        Update: {
          days_old?: never
          last_scraped_at?: string | null
          name?: string | null
          scrape_status?: string | null
          ticker?: string | null
        }
        Relationships: []
      }
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
