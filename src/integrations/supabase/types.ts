export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          active: boolean
          always_move: boolean
          auto_rotate: boolean | null
          color: string | null
          created_at: string
          direction: string | null
          display_duration: number | null
          gap: number | null
          id: string
          message: string
          message_ar: string
          speed: number | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          always_move?: boolean
          auto_rotate?: boolean | null
          color?: string | null
          created_at?: string
          direction?: string | null
          display_duration?: number | null
          gap?: number | null
          id?: string
          message: string
          message_ar: string
          speed?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          always_move?: boolean
          auto_rotate?: boolean | null
          color?: string | null
          created_at?: string
          direction?: string | null
          display_duration?: number | null
          gap?: number | null
          id?: string
          message?: string
          message_ar?: string
          speed?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          color_image_url: string | null
          created_at: string | null
          custom_request_id: string | null
          id: string
          product_id: string | null
          product_option_id: string | null
          quantity: number
          selected_color: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color_image_url?: string | null
          created_at?: string | null
          custom_request_id?: string | null
          id?: string
          product_id?: string | null
          product_option_id?: string | null
          quantity?: number
          selected_color?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color_image_url?: string | null
          created_at?: string | null
          custom_request_id?: string | null
          id?: string
          product_id?: string | null
          product_option_id?: string | null
          quantity?: number
          selected_color?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_custom_request_id_fkey"
            columns: ["custom_request_id"]
            isOneToOne: false
            referencedRelation: "custom_product_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_option_id_fkey"
            columns: ["product_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          description_ar: string | null
          icon: string
          id: string
          main_section_id: string | null
          name: string
          name_ar: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          icon: string
          id?: string
          main_section_id?: string | null
          name: string
          name_ar: string
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          icon?: string
          id?: string
          main_section_id?: string | null
          name?: string
          name_ar?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_main_section_id_fkey"
            columns: ["main_section_id"]
            isOneToOne: false
            referencedRelation: "main_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          coupon_id: string
          id: string
          used_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          used_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          current_uses: number | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          min_purchase_amount: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          current_uses?: number | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_purchase_amount?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          current_uses?: number | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_purchase_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      custom_product_requests: {
        Row: {
          admin_notes: string | null
          code: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          product_link: string
          product_name: string
          quantity: number
          status: string
          suggested_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          product_link: string
          product_name: string
          quantity?: number
          status?: string
          suggested_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          product_link?: string
          product_name?: string
          quantity?: number
          status?: string
          suggested_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      main_sections: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          name_ar: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          name_ar: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          name_ar?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          background_color: string | null
          created_at: string
          font_family: string | null
          id: string
          is_general: boolean
          message: string
          read: boolean
          related_id: string | null
          text_color: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          background_color?: string | null
          created_at?: string
          font_family?: string | null
          id?: string
          is_general?: boolean
          message: string
          read?: boolean
          related_id?: string | null
          text_color?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          background_color?: string | null
          created_at?: string
          font_family?: string | null
          id?: string
          is_general?: boolean
          message?: string
          read?: boolean
          related_id?: string | null
          text_color?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_name: string
          product_name_ar: string
          product_option_id: string | null
          quantity: number
          selected_color: string | null
          selected_option: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_name: string
          product_name_ar: string
          product_option_id?: string | null
          quantity?: number
          selected_color?: string | null
          selected_option?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          product_name_ar?: string
          product_option_id?: string | null
          quantity?: number
          selected_color?: string | null
          selected_option?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_option_id_fkey"
            columns: ["product_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          delivered_at: string | null
          governorate: string
          id: string
          order_number: string
          phone_number: string
          shipped_at: string | null
          shipping_address: string
          shipping_company: string | null
          shipping_notes: string | null
          status: string
          total_amount: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          delivered_at?: string | null
          governorate: string
          id?: string
          order_number: string
          phone_number: string
          shipped_at?: string | null
          shipping_address: string
          shipping_company?: string | null
          shipping_notes?: string | null
          status?: string
          total_amount: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          delivered_at?: string | null
          governorate?: string
          id?: string
          order_number?: string
          phone_number?: string
          shipped_at?: string | null
          shipping_address?: string
          shipping_company?: string | null
          shipping_notes?: string | null
          status?: string
          total_amount?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_options: {
        Row: {
          created_at: string
          id: string
          in_stock: boolean | null
          name: string
          name_ar: string
          price_adjustment: number | null
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          in_stock?: boolean | null
          name: string
          name_ar: string
          price_adjustment?: number | null
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          in_stock?: boolean | null
          name?: string
          name_ar?: string
          price_adjustment?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          availability_type: string
          category_id: string | null
          colors: Json | null
          created_at: string | null
          currency: string | null
          description: string | null
          description_ar: string | null
          featured: boolean | null
          features: Json | null
          id: string
          image_url: string | null
          images: string[] | null
          in_stock: boolean | null
          name: string
          name_ar: string
          original_price: number | null
          pre_order_fast_shipping_price: number | null
          pre_order_free_shipping_price: number | null
          price: number
          slug: string
          updated_at: string | null
        }
        Insert: {
          availability_type?: string
          category_id?: string | null
          colors?: Json | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          featured?: boolean | null
          features?: Json | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          in_stock?: boolean | null
          name: string
          name_ar: string
          original_price?: number | null
          pre_order_fast_shipping_price?: number | null
          pre_order_free_shipping_price?: number | null
          price: number
          slug: string
          updated_at?: string | null
        }
        Update: {
          availability_type?: string
          category_id?: string | null
          colors?: Json | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          featured?: boolean | null
          features?: Json | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          in_stock?: boolean | null
          name?: string
          name_ar?: string
          original_price?: number | null
          pre_order_fast_shipping_price?: number | null
          pre_order_free_shipping_price?: number | null
          price?: number
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          governorate: string | null
          id: string
          phone_number: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          governorate?: string | null
          id: string
          phone_number?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          governorate?: string | null
          id?: string
          phone_number?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      generate_request_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      send_general_notification: {
        Args: { _message: string; _title: string; _type?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
