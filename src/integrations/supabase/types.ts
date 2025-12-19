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
      admin_telegram_context: {
        Row: {
          admin_telegram_chat_id: string
          conversation_id: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_telegram_chat_id: string
          conversation_id?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_telegram_chat_id?: string
          conversation_id?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_telegram_context_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          option_image_url: string | null
          product_id: string | null
          product_option_id: string | null
          quantity: number
          selected_color: string | null
          shipping_option_index: number | null
          shipping_option_name_ar: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color_image_url?: string | null
          created_at?: string | null
          custom_request_id?: string | null
          id?: string
          option_image_url?: string | null
          product_id?: string | null
          product_option_id?: string | null
          quantity?: number
          selected_color?: string | null
          shipping_option_index?: number | null
          shipping_option_name_ar?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color_image_url?: string | null
          created_at?: string | null
          custom_request_id?: string | null
          id?: string
          option_image_url?: string | null
          product_id?: string | null
          product_option_id?: string | null
          quantity?: number
          selected_color?: string | null
          shipping_option_index?: number | null
          shipping_option_name_ar?: string | null
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
      competition_tickets: {
        Row: {
          competition_id: string
          id: string
          is_winner: boolean
          purchased_at: string
          ticket_number: string
          user_id: string
        }
        Insert: {
          competition_id: string
          id?: string
          is_winner?: boolean
          purchased_at?: string
          ticket_number: string
          user_id: string
        }
        Update: {
          competition_id?: string
          id?: string
          is_winner?: boolean
          purchased_at?: string
          ticket_number?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_tickets_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          competition_type: Database["public"]["Enums"]["competition_type"]
          created_at: string
          currency: string
          description: string | null
          description_ar: string | null
          draw_date: string | null
          end_date: string | null
          id: string
          image_url: string | null
          max_tickets: number | null
          prize_description: string
          prize_description_ar: string
          prize_value: number | null
          start_date: string
          status: Database["public"]["Enums"]["competition_status"]
          target_participants: number | null
          ticket_price: number
          title: string
          title_ar: string
          updated_at: string
          winner_ticket_id: string | null
          winner_user_id: string | null
        }
        Insert: {
          competition_type?: Database["public"]["Enums"]["competition_type"]
          created_at?: string
          currency?: string
          description?: string | null
          description_ar?: string | null
          draw_date?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          max_tickets?: number | null
          prize_description: string
          prize_description_ar: string
          prize_value?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["competition_status"]
          target_participants?: number | null
          ticket_price?: number
          title: string
          title_ar: string
          updated_at?: string
          winner_ticket_id?: string | null
          winner_user_id?: string | null
        }
        Update: {
          competition_type?: Database["public"]["Enums"]["competition_type"]
          created_at?: string
          currency?: string
          description?: string | null
          description_ar?: string | null
          draw_date?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          max_tickets?: number | null
          prize_description?: string
          prize_description_ar?: string
          prize_value?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["competition_status"]
          target_participants?: number | null
          ticket_price?: number
          title?: string
          title_ar?: string
          updated_at?: string
          winner_ticket_id?: string | null
          winner_user_id?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          order_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      daily_tasks: {
        Row: {
          created_at: string
          description_ar: string
          display_order: number
          icon: string
          id: string
          is_active: boolean
          points_reward: number
          task_key: string
          task_type: string
          title_ar: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar: string
          display_order?: number
          icon: string
          id?: string
          is_active?: boolean
          points_reward?: number
          task_key: string
          task_type: string
          title_ar: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          points_reward?: number
          task_key?: string
          task_type?: string
          title_ar?: string
          updated_at?: string
        }
        Relationships: []
      }
      default_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
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
      gig_applications: {
        Row: {
          cover_letter: string | null
          created_at: string
          gig_id: string
          id: string
          proposed_budget: number | null
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string
          gig_id: string
          id?: string
          proposed_budget?: number | null
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          cover_letter?: string | null
          created_at?: string
          gig_id?: string
          id?: string
          proposed_budget?: number | null
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_applications_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      gigs: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          category: string | null
          created_at: string
          currency: string | null
          deadline: string | null
          description: string | null
          description_ar: string | null
          id: string
          manager_id: string
          skills_required: string[] | null
          status: string
          title: string
          title_ar: string
          updated_at: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          created_at?: string
          currency?: string | null
          deadline?: string | null
          description?: string | null
          description_ar?: string | null
          id?: string
          manager_id: string
          skills_required?: string[] | null
          status?: string
          title: string
          title_ar: string
          updated_at?: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          created_at?: string
          currency?: string | null
          deadline?: string | null
          description?: string | null
          description_ar?: string | null
          id?: string
          manager_id?: string
          skills_required?: string[] | null
          status?: string
          title?: string
          title_ar?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_templates: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          name_ar: string
          template_config: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          name_ar: string
          template_config?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          name_ar?: string
          template_config?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      loyalty_levels: {
        Row: {
          benefits: Json
          bonus_points_percentage: number | null
          color: string
          created_at: string
          discount_percentage: number | null
          display_order: number
          free_shipping: boolean | null
          icon: string | null
          id: string
          level_key: string
          min_points: number
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          benefits?: Json
          bonus_points_percentage?: number | null
          color: string
          created_at?: string
          discount_percentage?: number | null
          display_order: number
          free_shipping?: boolean | null
          icon?: string | null
          id?: string
          level_key: string
          min_points?: number
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          benefits?: Json
          bonus_points_percentage?: number | null
          color?: string
          created_at?: string
          discount_percentage?: number | null
          display_order?: number
          free_shipping?: boolean | null
          icon?: string | null
          id?: string
          level_key?: string
          min_points?: number
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
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
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
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
          color_image_url: string | null
          created_at: string
          custom_request_id: string | null
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          product_name_ar: string
          product_option_id: string | null
          quantity: number
          selected_color: string | null
          selected_option: string | null
          shipping_option_name_ar: string | null
          shipping_price_adjustment: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          color_image_url?: string | null
          created_at?: string
          custom_request_id?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          product_name_ar: string
          product_option_id?: string | null
          quantity?: number
          selected_color?: string | null
          selected_option?: string | null
          shipping_option_name_ar?: string | null
          shipping_price_adjustment?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          color_image_url?: string | null
          created_at?: string
          custom_request_id?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_name_ar?: string
          product_option_id?: string | null
          quantity?: number
          selected_color?: string | null
          selected_option?: string | null
          shipping_option_name_ar?: string | null
          shipping_price_adjustment?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_custom_request_id_fkey"
            columns: ["custom_request_id"]
            isOneToOne: false
            referencedRelation: "custom_product_requests"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "order_items_product_id_fkey_products"
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
          {
            foreignKeyName: "order_items_product_option_id_fkey_product_options"
            columns: ["product_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          actual_weight: number | null
          admin_files: string[] | null
          admin_images: string[] | null
          admin_other_costs: number | null
          admin_paid_amount: number | null
          admin_product_cost: number | null
          admin_shipping_cost: number | null
          arrived_iraq_at: string | null
          arrived_warehouse_at: string | null
          auto_confirmed: boolean | null
          created_at: string
          currency: string
          customer_paid_amount: number | null
          customs_declaration_number: string | null
          delivered_at: string | null
          discount_amount: number | null
          estimated_delivery_date: string | null
          financial_notes: string | null
          governorate: string
          id: string
          internal_notes: string | null
          order_number: string
          package_dimensions: string | null
          paid_amount: number | null
          payment_method: string | null
          payment_status: string | null
          phone_number: string
          priority: string | null
          profit_amount: number | null
          remaining_amount: number | null
          serial_number_image_url: string | null
          shipped_at: string | null
          shipping_address: string
          shipping_duration_days: number | null
          shipping_notes: string | null
          shipping_route_type: string | null
          shipping_route_waypoints: Json | null
          status: string
          subtotal: number | null
          tax_amount: number | null
          tax_percentage: number | null
          total_amount: number
          updated_at: string
          user_confirmed_at: string | null
          user_confirmed_delivery: boolean | null
          user_id: string
        }
        Insert: {
          actual_weight?: number | null
          admin_files?: string[] | null
          admin_images?: string[] | null
          admin_other_costs?: number | null
          admin_paid_amount?: number | null
          admin_product_cost?: number | null
          admin_shipping_cost?: number | null
          arrived_iraq_at?: string | null
          arrived_warehouse_at?: string | null
          auto_confirmed?: boolean | null
          created_at?: string
          currency?: string
          customer_paid_amount?: number | null
          customs_declaration_number?: string | null
          delivered_at?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          financial_notes?: string | null
          governorate: string
          id?: string
          internal_notes?: string | null
          order_number: string
          package_dimensions?: string | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          phone_number: string
          priority?: string | null
          profit_amount?: number | null
          remaining_amount?: number | null
          serial_number_image_url?: string | null
          shipped_at?: string | null
          shipping_address: string
          shipping_duration_days?: number | null
          shipping_notes?: string | null
          shipping_route_type?: string | null
          shipping_route_waypoints?: Json | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          tax_percentage?: number | null
          total_amount: number
          updated_at?: string
          user_confirmed_at?: string | null
          user_confirmed_delivery?: boolean | null
          user_id: string
        }
        Update: {
          actual_weight?: number | null
          admin_files?: string[] | null
          admin_images?: string[] | null
          admin_other_costs?: number | null
          admin_paid_amount?: number | null
          admin_product_cost?: number | null
          admin_shipping_cost?: number | null
          arrived_iraq_at?: string | null
          arrived_warehouse_at?: string | null
          auto_confirmed?: boolean | null
          created_at?: string
          currency?: string
          customer_paid_amount?: number | null
          customs_declaration_number?: string | null
          delivered_at?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          financial_notes?: string | null
          governorate?: string
          id?: string
          internal_notes?: string | null
          order_number?: string
          package_dimensions?: string | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          phone_number?: string
          priority?: string | null
          profit_amount?: number | null
          remaining_amount?: number | null
          serial_number_image_url?: string | null
          shipped_at?: string | null
          shipping_address?: string
          shipping_duration_days?: number | null
          shipping_notes?: string | null
          shipping_route_type?: string | null
          shipping_route_waypoints?: Json | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          tax_percentage?: number | null
          total_amount?: number
          updated_at?: string
          user_confirmed_at?: string | null
          user_confirmed_delivery?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      points_transactions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          points: number
          related_id: string | null
          source: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          points: number
          related_id?: string | null
          source: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          related_id?: string | null
          source?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      product_options: {
        Row: {
          available_for_direct_sale: boolean | null
          available_for_pre_order: boolean | null
          created_at: string
          id: string
          image_url: string | null
          in_stock: boolean | null
          name: string
          name_ar: string
          price_adjustment: number | null
          product_id: string
        }
        Insert: {
          available_for_direct_sale?: boolean | null
          available_for_pre_order?: boolean | null
          created_at?: string
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          name: string
          name_ar: string
          price_adjustment?: number | null
          product_id: string
        }
        Update: {
          available_for_direct_sale?: boolean | null
          available_for_pre_order?: boolean | null
          created_at?: string
          id?: string
          image_url?: string | null
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
          has_in_stock: boolean | null
          has_pre_order: boolean | null
          id: string
          image_url: string | null
          images: string[] | null
          in_stock: boolean | null
          name: string
          name_ar: string
          original_price: number | null
          pre_order_fast_shipping_price: number | null
          pre_order_free_shipping_price: number | null
          pre_order_shipping_options: Json | null
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
          has_in_stock?: boolean | null
          has_pre_order?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          in_stock?: boolean | null
          name: string
          name_ar: string
          original_price?: number | null
          pre_order_fast_shipping_price?: number | null
          pre_order_free_shipping_price?: number | null
          pre_order_shipping_options?: Json | null
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
          has_in_stock?: boolean | null
          has_pre_order?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          in_stock?: boolean | null
          name?: string
          name_ar?: string
          original_price?: number | null
          pre_order_fast_shipping_price?: number | null
          pre_order_free_shipping_price?: number | null
          pre_order_shipping_options?: Json | null
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
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          governorate: string | null
          id: string
          phone_number: string | null
          telegram_chat_id: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          governorate?: string | null
          id: string
          phone_number?: string | null
          telegram_chat_id?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          governorate?: string | null
          id?: string
          phone_number?: string | null
          telegram_chat_id?: string | null
          username?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          media_files: string[] | null
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          media_files?: string[] | null
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          media_files?: string[] | null
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_invoices: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          invoice_html: string
          notes: string | null
          order_id: string
          template_id: string | null
          updated_at: string
          warranty_expires_at: string | null
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          invoice_html: string
          notes?: string | null
          order_id: string
          template_id?: string | null
          updated_at?: string
          warranty_expires_at?: string | null
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          invoice_html?: string
          notes?: string | null
          order_id?: string
          template_id?: string | null
          updated_at?: string
          warranty_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_invoices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_addresses: {
        Row: {
          additional_notes: string | null
          area: string
          created_at: string
          full_name: string
          governorate: string
          id: string
          is_default: boolean
          nearest_landmark: string
          neighborhood: string | null
          phone_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          area: string
          created_at?: string
          full_name: string
          governorate: string
          id?: string
          is_default?: boolean
          nearest_landmark: string
          neighborhood?: string | null
          phone_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          area?: string
          created_at?: string
          full_name?: string
          governorate?: string
          id?: string
          is_default?: boolean
          nearest_landmark?: string
          neighborhood?: string | null
          phone_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_points: {
        Row: {
          available_points: number
          created_at: string
          id: string
          level: string | null
          redeemed_points: number
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_points?: number
          created_at?: string
          id?: string
          level?: string | null
          redeemed_points?: number
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_points?: number
          created_at?: string
          id?: string
          level?: string | null
          redeemed_points?: number
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          points_awarded: number | null
          referral_code: string
          referred_user_id: string | null
          referrer_user_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          points_awarded?: number | null
          referral_code: string
          referred_user_id?: string | null
          referrer_user_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          points_awarded?: number | null
          referral_code?: string
          referred_user_id?: string | null
          referrer_user_id?: string
          status?: string
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
      user_task_completions: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          points_earned: number
          task_key: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          points_earned?: number
          task_key: string
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          points_earned?: number
          task_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          payment_method: string | null
          payment_proof_url: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          payment_method?: string | null
          payment_proof_url?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          payment_method?: string | null
          payment_proof_url?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_confirm_delivery: { Args: never; Returns: undefined }
      calculate_user_level: { Args: { points: number }; Returns: string }
      check_username_available: {
        Args: { username_to_check: string }
        Returns: boolean
      }
      complete_daily_task: { Args: { task_key_param: string }; Returns: Json }
      convert_points_to_wallet: {
        Args: { points_amount: number }
        Returns: Json
      }
      create_notification_if_not_exists: {
        Args: {
          p_is_general?: boolean
          p_message: string
          p_related_id?: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: undefined
      }
      delete_old_notifications: { Args: never; Returns: undefined }
      draw_competition_winner: { Args: { comp_id: string }; Returns: Json }
      generate_order_number: { Args: never; Returns: string }
      generate_referral_code:
        | { Args: never; Returns: string }
        | { Args: { user_username: string }; Returns: string }
      generate_request_code: { Args: never; Returns: string }
      generate_ticket_number: { Args: { comp_id: string }; Returns: string }
      has_purchased_product: {
        Args: { p_product_id: string; p_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      purchase_competition_ticket: { Args: { comp_id: string }; Returns: Json }
      send_general_notification: {
        Args: { _message: string; _title: string; _type?: string }
        Returns: undefined
      }
      validate_coupon: { Args: { coupon_code: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user" | "manager" | "worker"
      competition_status: "draft" | "active" | "completed" | "cancelled"
      competition_type: "ticket_count" | "all_tickets_sold" | "timed" | "free"
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
      app_role: ["admin", "user", "manager", "worker"],
      competition_status: ["draft", "active", "completed", "cancelled"],
      competition_type: ["ticket_count", "all_tickets_sold", "timed", "free"],
    },
  },
} as const
