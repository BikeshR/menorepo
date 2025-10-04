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
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
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
      transactions: {
        Row: {
          created_at: string
          fees: number
          id: string
          investment_id: string | null
          notes: string | null
          price: number
          quantity: number
          symbol: string
          total_amount: number
          transaction_date: string
          type: Database['public']['Enums']['transaction_type']
          user_id: string
        }
        Insert: {
          created_at?: string
          fees?: number
          id?: string
          investment_id?: string | null
          notes?: string | null
          price: number
          quantity: number
          symbol: string
          total_amount: number
          transaction_date?: string
          type: Database['public']['Enums']['transaction_type']
          user_id: string
        }
        Update: {
          created_at?: string
          fees?: number
          id?: string
          investment_id?: string | null
          notes?: string | null
          price?: number
          quantity?: number
          symbol?: string
          total_amount?: number
          transaction_date?: string
          type?: Database['public']['Enums']['transaction_type']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_investment_id_fkey'
            columns: ['investment_id']
            isOneToOne: false
            referencedRelation: 'investments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
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

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema['CompositeTypes']
    ? PublicSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never
