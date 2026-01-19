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
      banners: {
        Row: {
          action_type: string
          button_text: string | null
          button_text_ar: string | null
          coupon_code: string | null
          created_at: string
          crop_settings: Json | null
          display_order: number
          end_date: string | null
          external_url: string | null
          id: string
          image_url: string
          is_active: boolean
          page_url: string | null
          product_id: string | null
          start_date: string | null
          title: string
          title_ar: string
          updated_at: string
        }
        Insert: {
          action_type?: string
          button_text?: string | null
          button_text_ar?: string | null
          coupon_code?: string | null
          created_at?: string
          crop_settings?: Json | null
          display_order?: number
          end_date?: string | null
          external_url?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          page_url?: string | null
          product_id?: string | null
          start_date?: string | null
          title: string
          title_ar: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          button_text?: string | null
          button_text_ar?: string | null
          coupon_code?: string | null
          created_at?: string
          crop_settings?: Json | null
          display_order?: number
          end_date?: string | null
          external_url?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          page_url?: string | null
          product_id?: string | null
          start_date?: string | null
          title?: string
          title_ar?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      card_exclusive_offers: {
        Row: {
          created_at: string
          description_ar: string | null
          id: string
          image_url: string | null
          is_active: boolean
          min_card_level_id: string | null
          offer_type: string
          offer_value: number | null
          title_ar: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_card_level_id?: string | null
          offer_type?: string
          offer_value?: number | null
          title_ar: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_card_level_id?: string | null
          offer_type?: string
          offer_value?: number | null
          title_ar?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_exclusive_offers_min_card_level_id_fkey"
            columns: ["min_card_level_id"]
            isOneToOne: false
            referencedRelation: "loyalty_levels"
            referencedColumns: ["id"]
          },
        ]
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
      cart_requests: {
        Row: {
          adjusted_total: number | null
          admin_notes: string | null
          cart_code: string
          cart_items: Json
          conversation_id: string | null
          created_at: string
          id: string
          original_total: number
          status: string
          updated_at: string
          user_id: string
          user_notes: string | null
        }
        Insert: {
          adjusted_total?: number | null
          admin_notes?: string | null
          cart_code: string
          cart_items?: Json
          conversation_id?: string | null
          created_at?: string
          id?: string
          original_total?: number
          status?: string
          updated_at?: string
          user_id: string
          user_notes?: string | null
        }
        Update: {
          adjusted_total?: number | null
          admin_notes?: string | null
          cart_code?: string
          cart_items?: Json
          conversation_id?: string | null
          created_at?: string
          id?: string
          original_total?: number
          status?: string
          updated_at?: string
          user_id?: string
          user_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
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
      competition_prizes: {
        Row: {
          competition_id: string | null
          competition_ticket_id: string | null
          coupon_code: string | null
          coupon_used: boolean | null
          created_at: string
          delivered_at: string | null
          id: string
          prize_image_url: string | null
          prize_name_ar: string
          prize_type: string
          prize_value: number | null
          product_id: string | null
          shipped_at: string | null
          shipping_requested_at: string | null
          source_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          competition_id?: string | null
          competition_ticket_id?: string | null
          coupon_code?: string | null
          coupon_used?: boolean | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          prize_image_url?: string | null
          prize_name_ar: string
          prize_type?: string
          prize_value?: number | null
          product_id?: string | null
          shipped_at?: string | null
          shipping_requested_at?: string | null
          source_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          competition_id?: string | null
          competition_ticket_id?: string | null
          coupon_code?: string | null
          coupon_used?: boolean | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          prize_image_url?: string | null
          prize_name_ar?: string
          prize_type?: string
          prize_value?: number | null
          product_id?: string | null
          shipped_at?: string | null
          shipping_requested_at?: string | null
          source_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_prizes_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_prizes_competition_ticket_id_fkey"
            columns: ["competition_ticket_id"]
            isOneToOne: false
            referencedRelation: "competition_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_prizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_tickets: {
        Row: {
          competition_id: string | null
          id: string
          is_winner: boolean
          letter_awarded: string | null
          prize_tier_id: string | null
          prize_won: Json | null
          purchased_at: string
          revealed_at: string | null
          team: string | null
          ticket_number: string
          user_id: string
        }
        Insert: {
          competition_id?: string | null
          id?: string
          is_winner?: boolean
          letter_awarded?: string | null
          prize_tier_id?: string | null
          prize_won?: Json | null
          purchased_at?: string
          revealed_at?: string | null
          team?: string | null
          ticket_number: string
          user_id: string
        }
        Update: {
          competition_id?: string | null
          id?: string
          is_winner?: boolean
          letter_awarded?: string | null
          prize_tier_id?: string | null
          prize_won?: Json | null
          purchased_at?: string
          revealed_at?: string | null
          team?: string | null
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
          flash_badge_text: string | null
          gift_tickets_per_purchase: number | null
          growing_prize_config: Json | null
          hidden_winner_ticket_id: string | null
          hidden_winner_trigger_ticket: number | null
          hide_participants: boolean | null
          id: string
          image_url: string | null
          images: string[] | null
          instant_reveal: boolean | null
          is_featured: boolean | null
          is_flash: boolean | null
          is_product_based: boolean | null
          legal_disclaimer: string | null
          letters_config: Json | null
          max_tickets: number | null
          mystery_boxes: Json | null
          price_tiers: Json | null
          prize_description: string
          prize_description_ar: string
          prize_product_id: string | null
          prize_products: Json | null
          prize_tiers: Json | null
          prize_value: number | null
          product_id: string | null
          remaining_prizes: number | null
          required_tickets: number
          start_date: string
          status: Database["public"]["Enums"]["competition_status"]
          target_participants: number | null
          team_a_count: number | null
          team_b_count: number | null
          team_config: Json | null
          theme_color: string | null
          ticket_price: number
          title: string
          title_ar: string
          unlimited_winners: boolean | null
          updated_at: string
          win_probability: number | null
          winner_ticket_id: string | null
          winner_ticket_ids: string[] | null
          winner_user_id: string | null
          winner_user_ids: string[] | null
          winners_count: number
        }
        Insert: {
          competition_type?: Database["public"]["Enums"]["competition_type"]
          created_at?: string
          currency?: string
          description?: string | null
          description_ar?: string | null
          draw_date?: string | null
          end_date?: string | null
          flash_badge_text?: string | null
          gift_tickets_per_purchase?: number | null
          growing_prize_config?: Json | null
          hidden_winner_ticket_id?: string | null
          hidden_winner_trigger_ticket?: number | null
          hide_participants?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          instant_reveal?: boolean | null
          is_featured?: boolean | null
          is_flash?: boolean | null
          is_product_based?: boolean | null
          legal_disclaimer?: string | null
          letters_config?: Json | null
          max_tickets?: number | null
          mystery_boxes?: Json | null
          price_tiers?: Json | null
          prize_description: string
          prize_description_ar: string
          prize_product_id?: string | null
          prize_products?: Json | null
          prize_tiers?: Json | null
          prize_value?: number | null
          product_id?: string | null
          remaining_prizes?: number | null
          required_tickets?: number
          start_date?: string
          status?: Database["public"]["Enums"]["competition_status"]
          target_participants?: number | null
          team_a_count?: number | null
          team_b_count?: number | null
          team_config?: Json | null
          theme_color?: string | null
          ticket_price?: number
          title: string
          title_ar: string
          unlimited_winners?: boolean | null
          updated_at?: string
          win_probability?: number | null
          winner_ticket_id?: string | null
          winner_ticket_ids?: string[] | null
          winner_user_id?: string | null
          winner_user_ids?: string[] | null
          winners_count?: number
        }
        Update: {
          competition_type?: Database["public"]["Enums"]["competition_type"]
          created_at?: string
          currency?: string
          description?: string | null
          description_ar?: string | null
          draw_date?: string | null
          end_date?: string | null
          flash_badge_text?: string | null
          gift_tickets_per_purchase?: number | null
          growing_prize_config?: Json | null
          hidden_winner_ticket_id?: string | null
          hidden_winner_trigger_ticket?: number | null
          hide_participants?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          instant_reveal?: boolean | null
          is_featured?: boolean | null
          is_flash?: boolean | null
          is_product_based?: boolean | null
          legal_disclaimer?: string | null
          letters_config?: Json | null
          max_tickets?: number | null
          mystery_boxes?: Json | null
          price_tiers?: Json | null
          prize_description?: string
          prize_description_ar?: string
          prize_product_id?: string | null
          prize_products?: Json | null
          prize_tiers?: Json | null
          prize_value?: number | null
          product_id?: string | null
          remaining_prizes?: number | null
          required_tickets?: number
          start_date?: string
          status?: Database["public"]["Enums"]["competition_status"]
          target_participants?: number | null
          team_a_count?: number | null
          team_b_count?: number | null
          team_config?: Json | null
          theme_color?: string | null
          ticket_price?: number
          title?: string
          title_ar?: string
          unlimited_winners?: boolean | null
          updated_at?: string
          win_probability?: number | null
          winner_ticket_id?: string | null
          winner_ticket_ids?: string[] | null
          winner_user_id?: string | null
          winner_user_ids?: string[] | null
          winners_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "competitions_prize_product_id_fkey"
            columns: ["prize_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      coupon_validation_attempts: {
        Row: {
          attempted_code: string
          created_at: string | null
          id: string
          ip_identifier: string | null
          success: boolean | null
          user_id: string | null
        }
        Insert: {
          attempted_code: string
          created_at?: string | null
          id?: string
          ip_identifier?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Update: {
          attempted_code?: string
          created_at?: string | null
          id?: string
          ip_identifier?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Relationships: []
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
          estimated_shipping_cost: number | null
          id: string
          image_url: string | null
          product_dimensions: Json | null
          product_link: string
          product_name: string
          product_weight: number | null
          quantity: number
          shipping_from: string | null
          shipping_notes: string | null
          shipping_type: string | null
          source_country: string | null
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
          estimated_shipping_cost?: number | null
          id?: string
          image_url?: string | null
          product_dimensions?: Json | null
          product_link: string
          product_name: string
          product_weight?: number | null
          quantity?: number
          shipping_from?: string | null
          shipping_notes?: string | null
          shipping_type?: string | null
          source_country?: string | null
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
          estimated_shipping_cost?: number | null
          id?: string
          image_url?: string | null
          product_dimensions?: Json | null
          product_link?: string
          product_name?: string
          product_weight?: number | null
          quantity?: number
          shipping_from?: string | null
          shipping_notes?: string | null
          shipping_type?: string | null
          source_country?: string | null
          status?: string
          suggested_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_redemption_log: {
        Row: {
          created_at: string
          id: string
          points_redeemed: number
          redeemed_at: string
          redemption_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_redeemed: number
          redeemed_at?: string
          redemption_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_redeemed?: number
          redeemed_at?: string
          redemption_type?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_tasks: {
        Row: {
          confirmation_type: string | null
          created_at: string
          description_ar: string
          display_order: number
          icon: string
          id: string
          is_active: boolean
          max_streak_days: number | null
          points_reward: number
          requires_confirmation: boolean | null
          streak_bonus_enabled: boolean | null
          streak_bonus_per_day: number | null
          task_key: string
          task_type: string
          title_ar: string
          updated_at: string
        }
        Insert: {
          confirmation_type?: string | null
          created_at?: string
          description_ar: string
          display_order?: number
          icon: string
          id?: string
          is_active?: boolean
          max_streak_days?: number | null
          points_reward?: number
          requires_confirmation?: boolean | null
          streak_bonus_enabled?: boolean | null
          streak_bonus_per_day?: number | null
          task_key: string
          task_type: string
          title_ar: string
          updated_at?: string
        }
        Update: {
          confirmation_type?: string | null
          created_at?: string
          description_ar?: string
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          max_streak_days?: number | null
          points_reward?: number
          requires_confirmation?: boolean | null
          streak_bonus_enabled?: boolean | null
          streak_bonus_per_day?: number | null
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
      instagram_share_submissions: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          image_url: string
          instagram_username: string | null
          points_awarded: number | null
          product_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          image_url: string
          instagram_username?: string | null
          points_awarded?: number | null
          product_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          image_url?: string
          instagram_username?: string | null
          points_awarded?: number | null
          product_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
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
      letter_prize_coupons: {
        Row: {
          competition_id: string | null
          coupon_code: string
          created_at: string
          expires_at: string | null
          id: string
          is_used: boolean
          prize_name_ar: string
          prize_value: number
          product_id: string | null
          redemption_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          competition_id?: string | null
          coupon_code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean
          prize_name_ar: string
          prize_value?: number
          product_id?: string | null
          redemption_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          competition_id?: string | null
          coupon_code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean
          prize_name_ar?: string
          prize_value?: number
          product_id?: string | null
          redemption_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_prize_coupons_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_prize_coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_prize_coupons_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: false
            referencedRelation: "letter_prize_redemptions"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_prize_redemptions: {
        Row: {
          competition_id: string | null
          created_at: string
          id: string
          letters_used: Json
          prize_name_ar: string
          prize_value: number
          product_id: string | null
          redeemed_at: string
          redeemed_word: string
          user_id: string
        }
        Insert: {
          competition_id?: string | null
          created_at?: string
          id?: string
          letters_used?: Json
          prize_name_ar: string
          prize_value?: number
          product_id?: string | null
          redeemed_at?: string
          redeemed_word: string
          user_id: string
        }
        Update: {
          competition_id?: string | null
          created_at?: string
          id?: string
          letters_used?: Json
          prize_name_ar?: string
          prize_value?: number
          product_id?: string | null
          redeemed_at?: string
          redeemed_word?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_prize_redemptions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_prize_redemptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_conversations: {
        Row: {
          admin_joined: boolean | null
          buyer_id: string
          conversation_code: string | null
          created_at: string
          id: string
          listing_id: string
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_joined?: boolean | null
          buyer_id: string
          conversation_code?: string | null
          created_at?: string
          id?: string
          listing_id: string
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_joined?: boolean | null
          buyer_id?: string
          conversation_code?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "user_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_favorites: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "user_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_fees_settings: {
        Row: {
          created_at: string
          fee_type: string
          fee_value: number
          id: string
          is_active: boolean | null
          max_fee: number | null
          min_fee: number | null
          terms_ar: string | null
          terms_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee_type?: string
          fee_value?: number
          id?: string
          is_active?: boolean | null
          max_fee?: number | null
          min_fee?: number | null
          terms_ar?: string | null
          terms_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee_type?: string
          fee_value?: number
          id?: string
          is_active?: boolean | null
          max_fee?: number | null
          min_fee?: number | null
          terms_ar?: string | null
          terms_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      listing_likes: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_likes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "user_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          is_read: boolean | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "listing_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_transactions: {
        Row: {
          amount: number
          buyer_id: string
          completed_at: string | null
          created_at: string
          id: string
          listing_id: string
          phone_number: string | null
          platform_fee: number | null
          seller_amount: number
          seller_id: string
          shipping_address: string | null
          shipping_method: string
          status: string
          tracking_info: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          listing_id: string
          phone_number?: string | null
          platform_fee?: number | null
          seller_amount: number
          seller_id: string
          shipping_address?: string | null
          shipping_method: string
          status?: string
          tracking_info?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          phone_number?: string | null
          platform_fee?: number | null
          seller_amount?: number
          seller_id?: string
          shipping_address?: string | null
          shipping_method?: string
          status?: string
          tracking_info?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "user_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_views: {
        Row: {
          last_viewed_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          last_viewed_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          last_viewed_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_views_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "user_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_levels: {
        Row: {
          benefits: Json
          bonus_points_percentage: number | null
          card_discounts_enabled: boolean | null
          color: string
          created_at: string
          discount_percentage: number | null
          display_order: number
          duration_days: number | null
          early_access: boolean | null
          exclusive_products: boolean | null
          free_shipping: boolean | null
          free_shipping_min_order: number | null
          icon: string | null
          id: string
          is_purchasable: boolean | null
          level_key: string
          min_points: number
          monthly_free_shipping: number | null
          name_ar: string
          name_en: string
          priority_shipping: boolean | null
          profile_effects: Json | null
          purchase_price_points: number | null
          special_name_style: Json | null
          updated_at: string
          vip_support: boolean | null
        }
        Insert: {
          benefits?: Json
          bonus_points_percentage?: number | null
          card_discounts_enabled?: boolean | null
          color: string
          created_at?: string
          discount_percentage?: number | null
          display_order: number
          duration_days?: number | null
          early_access?: boolean | null
          exclusive_products?: boolean | null
          free_shipping?: boolean | null
          free_shipping_min_order?: number | null
          icon?: string | null
          id?: string
          is_purchasable?: boolean | null
          level_key: string
          min_points?: number
          monthly_free_shipping?: number | null
          name_ar: string
          name_en: string
          priority_shipping?: boolean | null
          profile_effects?: Json | null
          purchase_price_points?: number | null
          special_name_style?: Json | null
          updated_at?: string
          vip_support?: boolean | null
        }
        Update: {
          benefits?: Json
          bonus_points_percentage?: number | null
          card_discounts_enabled?: boolean | null
          color?: string
          created_at?: string
          discount_percentage?: number | null
          display_order?: number
          duration_days?: number | null
          early_access?: boolean | null
          exclusive_products?: boolean | null
          free_shipping?: boolean | null
          free_shipping_min_order?: number | null
          icon?: string | null
          id?: string
          is_purchasable?: boolean | null
          level_key?: string
          min_points?: number
          monthly_free_shipping?: number | null
          name_ar?: string
          name_en?: string
          priority_shipping?: boolean | null
          profile_effects?: Json | null
          purchase_price_points?: number | null
          special_name_style?: Json | null
          updated_at?: string
          vip_support?: boolean | null
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
      marketplace_telegram_context: {
        Row: {
          conversation_id: string
          id: string
          telegram_chat_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          telegram_chat_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          telegram_chat_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_telegram_context_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "listing_conversations"
            referencedColumns: ["id"]
          },
        ]
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
          cost_price: number | null
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
          serial_number: string | null
          shipping_option_name_ar: string | null
          shipping_price_adjustment: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          color_image_url?: string | null
          cost_price?: number | null
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
          serial_number?: string | null
          shipping_option_name_ar?: string | null
          shipping_price_adjustment?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          color_image_url?: string | null
          cost_price?: number | null
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
          serial_number?: string | null
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
          cancelled_at: string | null
          confirmed_at: string | null
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
          on_the_way_at: string | null
          order_number: string
          package_dimensions: string | null
          paid_amount: number | null
          payment_method: string | null
          payment_status: string | null
          phone_number: string
          priority: string | null
          processing_at: string | null
          profit_amount: number | null
          purchased_at: string | null
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
          cancelled_at?: string | null
          confirmed_at?: string | null
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
          on_the_way_at?: string | null
          order_number: string
          package_dimensions?: string | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          phone_number: string
          priority?: string | null
          processing_at?: string | null
          profit_amount?: number | null
          purchased_at?: string | null
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
          cancelled_at?: string | null
          confirmed_at?: string | null
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
          on_the_way_at?: string | null
          order_number?: string
          package_dimensions?: string | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          phone_number?: string
          priority?: string | null
          processing_at?: string | null
          profit_amount?: number | null
          purchased_at?: string | null
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
      parts_discount_requests: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          created_at: string
          defect_description: string
          defect_images: string[] | null
          discount_percentage: number
          discounted_price: number
          expires_at: string | null
          id: string
          order_id: string | null
          original_price: number
          product_id: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string
          defect_description: string
          defect_images?: string[] | null
          discount_percentage: number
          discounted_price: number
          expires_at?: string | null
          id?: string
          order_id?: string | null
          original_price: number
          product_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string
          defect_description?: string
          defect_images?: string[] | null
          discount_percentage?: number
          discounted_price?: number
          expires_at?: string | null
          id?: string
          order_id?: string | null
          original_price?: number
          product_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_discount_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_discount_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_discount_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_discount_requests_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "printer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      points_product_redemptions: {
        Row: {
          created_at: string
          id: string
          points_spent: number
          product_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_spent: number
          product_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_spent?: number
          product_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_product_redemptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "points_redeemable_products"
            referencedColumns: ["id"]
          },
        ]
      }
      points_redeemable_products: {
        Row: {
          created_at: string
          description_ar: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          max_per_user: number | null
          points_cost: number
          product_type: string
          stock_quantity: number | null
          title_ar: string
          updated_at: string
          valid_days: number | null
          value_amount: number
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_per_user?: number | null
          points_cost: number
          product_type?: string
          stock_quantity?: number | null
          title_ar: string
          updated_at?: string
          valid_days?: number | null
          value_amount?: number
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_per_user?: number | null
          points_cost?: number
          product_type?: string
          stock_quantity?: number | null
          title_ar?: string
          updated_at?: string
          valid_days?: number | null
          value_amount?: number
        }
        Relationships: []
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
      printer_protection_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      printer_subscriptions: {
        Row: {
          admin_notes: string | null
          auto_renew: boolean | null
          cancelled_at: string | null
          created_at: string | null
          end_date: string | null
          id: string
          last_service_request_reset: string | null
          monthly_price: number
          next_billing_date: string | null
          paused_at: string | null
          plan_id: string
          refund_amount: number | null
          remaining_days: number | null
          service_requests_this_month: number | null
          start_date: string
          status:
            | Database["public"]["Enums"]["printer_subscription_status"]
            | null
          updated_at: string | null
          used_days: number | null
          user_id: string
          user_printer_id: string
          waiting_period_ends_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          auto_renew?: boolean | null
          cancelled_at?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          last_service_request_reset?: string | null
          monthly_price: number
          next_billing_date?: string | null
          paused_at?: string | null
          plan_id: string
          refund_amount?: number | null
          remaining_days?: number | null
          service_requests_this_month?: number | null
          start_date?: string
          status?:
            | Database["public"]["Enums"]["printer_subscription_status"]
            | null
          updated_at?: string | null
          used_days?: number | null
          user_id: string
          user_printer_id: string
          waiting_period_ends_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          auto_renew?: boolean | null
          cancelled_at?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          last_service_request_reset?: string | null
          monthly_price?: number
          next_billing_date?: string | null
          paused_at?: string | null
          plan_id?: string
          refund_amount?: number | null
          remaining_days?: number | null
          service_requests_this_month?: number | null
          start_date?: string
          status?:
            | Database["public"]["Enums"]["printer_subscription_status"]
            | null
          updated_at?: string | null
          used_days?: number | null
          user_id?: string
          user_printer_id?: string
          waiting_period_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printer_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "protection_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_subscriptions_user_printer_id_fkey"
            columns: ["user_printer_id"]
            isOneToOne: false
            referencedRelation: "user_printers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_card_discounts: {
        Row: {
          created_at: string
          discount_percentage: number
          id: string
          is_active: boolean
          level_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          discount_percentage?: number
          id?: string
          is_active?: boolean
          level_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          discount_percentage?: number
          id?: string
          is_active?: boolean
          level_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_card_discounts_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "loyalty_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_card_discounts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_offer_purchases: {
        Row: {
          created_at: string
          delivered_at: string | null
          gift_tickets_awarded: number
          id: string
          offer_id: string
          purchase_status: string
          quantity: number
          shipped_at: string | null
          shipping_requested_at: string | null
          total_price: number
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          gift_tickets_awarded: number
          id?: string
          offer_id: string
          purchase_status?: string
          quantity?: number
          shipped_at?: string | null
          shipping_requested_at?: string | null
          total_price: number
          unit_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          gift_tickets_awarded?: number
          id?: string
          offer_id?: string
          purchase_status?: string
          quantity?: number
          shipped_at?: string | null
          shipping_requested_at?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_offer_purchases_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "product_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_offers: {
        Row: {
          colors: Json | null
          cost_price: number | null
          created_at: string
          currency: string | null
          description: string | null
          description_ar: string | null
          gift_tickets: number
          id: string
          image_url: string | null
          images: string[] | null
          options: Json | null
          price: number
          status: string
          stock_quantity: number | null
          title: string
          title_ar: string
          total_sold: number | null
          updated_at: string
        }
        Insert: {
          colors?: Json | null
          cost_price?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          gift_tickets?: number
          id?: string
          image_url?: string | null
          images?: string[] | null
          options?: Json | null
          price?: number
          status?: string
          stock_quantity?: number | null
          title: string
          title_ar: string
          total_sold?: number | null
          updated_at?: string
        }
        Update: {
          colors?: Json | null
          cost_price?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          gift_tickets?: number
          id?: string
          image_url?: string | null
          images?: string[] | null
          options?: Json | null
          price?: number
          status?: string
          stock_quantity?: number | null
          title?: string
          title_ar?: string
          total_sold?: number | null
          updated_at?: string
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
          taobao_available: boolean | null
          taobao_last_sync_at: string | null
          taobao_sku_id: string | null
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
          taobao_available?: boolean | null
          taobao_last_sync_at?: string | null
          taobao_sku_id?: string | null
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
          taobao_available?: boolean | null
          taobao_last_sync_at?: string | null
          taobao_sku_id?: string | null
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
          card_discounts: Json | null
          category_id: string | null
          colors: Json | null
          cost_price: number | null
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
          points_reward: number | null
          pre_order_fast_shipping_price: number | null
          pre_order_free_shipping_price: number | null
          pre_order_shipping_options: Json | null
          price: number
          slug: string
          taobao_availability_cache: Json | null
          taobao_last_sync_at: string | null
          taobao_sync_status: string | null
          taobao_url: string | null
          taobao_variant_mapping: Json | null
          updated_at: string | null
        }
        Insert: {
          availability_type?: string
          card_discounts?: Json | null
          category_id?: string | null
          colors?: Json | null
          cost_price?: number | null
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
          points_reward?: number | null
          pre_order_fast_shipping_price?: number | null
          pre_order_free_shipping_price?: number | null
          pre_order_shipping_options?: Json | null
          price: number
          slug: string
          taobao_availability_cache?: Json | null
          taobao_last_sync_at?: string | null
          taobao_sync_status?: string | null
          taobao_url?: string | null
          taobao_variant_mapping?: Json | null
          updated_at?: string | null
        }
        Update: {
          availability_type?: string
          card_discounts?: Json | null
          category_id?: string | null
          colors?: Json | null
          cost_price?: number | null
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
          points_reward?: number | null
          pre_order_fast_shipping_price?: number | null
          pre_order_free_shipping_price?: number | null
          pre_order_shipping_options?: Json | null
          price?: number
          slug?: string
          taobao_availability_cache?: Json | null
          taobao_last_sync_at?: string | null
          taobao_sync_status?: string | null
          taobao_url?: string | null
          taobao_variant_mapping?: Json | null
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
          ban_reason: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          governorate: string | null
          id: string
          is_banned: boolean | null
          phone_number: string | null
          telegram_chat_id: string | null
          username: string
          warnings_count: number | null
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          governorate?: string | null
          id: string
          is_banned?: boolean | null
          phone_number?: string | null
          telegram_chat_id?: string | null
          username: string
          warnings_count?: number | null
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          governorate?: string | null
          id?: string
          is_banned?: boolean | null
          phone_number?: string | null
          telegram_chat_id?: string | null
          username?: string
          warnings_count?: number | null
        }
        Relationships: []
      }
      protection_plans: {
        Row: {
          annual_coverage_cap: number | null
          badge_text: string | null
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          display_order: number | null
          features: Json | null
          has_preventive_maintenance: boolean | null
          has_replacement_printer: boolean | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          maintenance_discount_percentage: number | null
          max_parts_discount_per_month: number | null
          max_service_requests_per_month: number | null
          monthly_price: number
          name_ar: string
          name_en: string
          parts_discount_categories: string[] | null
          parts_discount_percentage: number | null
          plan_type: Database["public"]["Enums"]["protection_plan_type"]
          preventive_maintenance_interval_months: number | null
          priority_level: number | null
          updated_at: string | null
          waiting_period_days: number | null
        }
        Insert: {
          annual_coverage_cap?: number | null
          badge_text?: string | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          features?: Json | null
          has_preventive_maintenance?: boolean | null
          has_replacement_printer?: boolean | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          maintenance_discount_percentage?: number | null
          max_parts_discount_per_month?: number | null
          max_service_requests_per_month?: number | null
          monthly_price: number
          name_ar: string
          name_en: string
          parts_discount_categories?: string[] | null
          parts_discount_percentage?: number | null
          plan_type: Database["public"]["Enums"]["protection_plan_type"]
          preventive_maintenance_interval_months?: number | null
          priority_level?: number | null
          updated_at?: string | null
          waiting_period_days?: number | null
        }
        Update: {
          annual_coverage_cap?: number | null
          badge_text?: string | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          features?: Json | null
          has_preventive_maintenance?: boolean | null
          has_replacement_printer?: boolean | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          maintenance_discount_percentage?: number | null
          max_parts_discount_per_month?: number | null
          max_service_requests_per_month?: number | null
          monthly_price?: number
          name_ar?: string
          name_en?: string
          parts_discount_categories?: string[] | null
          parts_discount_percentage?: number | null
          plan_type?: Database["public"]["Enums"]["protection_plan_type"]
          preventive_maintenance_interval_months?: number | null
          priority_level?: number | null
          updated_at?: string | null
          waiting_period_days?: number | null
        }
        Relationships: []
      }
      redemption_settings: {
        Row: {
          created_at: string
          description_ar: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          max_daily_points: number | null
          min_points: number
          name_ar: string
          points_per_unit: number
          redemption_type: string
          unit_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          max_daily_points?: number | null
          min_points?: number
          name_ar: string
          points_per_unit?: number
          redemption_type: string
          unit_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          max_daily_points?: number | null
          min_points?: number
          name_ar?: string
          points_per_unit?: number
          redemption_type?: string
          unit_value?: number
          updated_at?: string
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
      seller_profiles: {
        Row: {
          average_rating: number | null
          completed_orders: number | null
          created_at: string
          id: string
          is_verified: boolean | null
          total_reviews: number | null
          total_sales: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          average_rating?: number | null
          completed_orders?: number | null
          created_at?: string
          id?: string
          is_verified?: boolean | null
          total_reviews?: number | null
          total_sales?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          average_rating?: number | null
          completed_orders?: number | null
          created_at?: string
          id?: string
          is_verified?: boolean | null
          total_reviews?: number | null
          total_sales?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seller_reviews: {
        Row: {
          buyer_id: string
          comment: string | null
          created_at: string
          id: string
          listing_id: string | null
          rating: number
          seller_id: string
        }
        Insert: {
          buyer_id: string
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          rating: number
          seller_id: string
        }
        Update: {
          buyer_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          rating?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "user_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      serial_number_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          order_item_id: string
          product_name_ar: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          order_item_id: string
          product_name_ar: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          order_item_id?: string
          product_name_ar?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "serial_number_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serial_number_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items_for_serial"
            referencedColumns: ["order_item_id"]
          },
        ]
      }
      shipment_request_items: {
        Row: {
          created_at: string
          id: string
          purchased_product_id: string
          quantity: number
          shipment_request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          purchased_product_id: string
          quantity?: number
          shipment_request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          purchased_product_id?: string
          quantity?: number
          shipment_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_request_items_purchased_product_id_fkey"
            columns: ["purchased_product_id"]
            isOneToOne: false
            referencedRelation: "user_purchased_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_request_items_shipment_request_id_fkey"
            columns: ["shipment_request_id"]
            isOneToOne: false
            referencedRelation: "shipment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          delivered_at: string | null
          governorate: string | null
          id: string
          phone_number: string | null
          shipped_at: string | null
          shipping_address: string | null
          status: string
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          delivered_at?: string | null
          governorate?: string | null
          id?: string
          phone_number?: string | null
          shipped_at?: string | null
          shipping_address?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          delivered_at?: string | null
          governorate?: string | null
          id?: string
          phone_number?: string | null
          shipped_at?: string | null
          shipping_address?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shipping_settings: {
        Row: {
          created_at: string
          description_ar: string | null
          id: string
          setting_key: string
          setting_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          id?: string
          setting_key: string
          setting_value: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          id?: string
          setting_key?: string
          setting_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      store_printers: {
        Row: {
          buyer_user_id: string | null
          created_at: string | null
          id: string
          image_url: string | null
          is_registered: boolean | null
          model_name: string
          model_name_ar: string
          order_id: string | null
          order_item_id: string | null
          serial_number: string
          sold_at: string | null
          updated_at: string | null
        }
        Insert: {
          buyer_user_id?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_registered?: boolean | null
          model_name: string
          model_name_ar: string
          order_id?: string | null
          order_item_id?: string | null
          serial_number: string
          sold_at?: string | null
          updated_at?: string | null
        }
        Update: {
          buyer_user_id?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_registered?: boolean | null
          model_name?: string
          model_name_ar?: string
          order_id?: string | null
          order_item_id?: string | null
          serial_number?: string
          sold_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_printers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_printers_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_printers_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items_for_serial"
            referencedColumns: ["order_item_id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string | null
          credit_amount: number | null
          currency: string | null
          days_remaining: number | null
          id: string
          new_plan_id: string | null
          notes: string | null
          old_plan_id: string | null
          payment_type: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          credit_amount?: number | null
          currency?: string | null
          days_remaining?: number | null
          id?: string
          new_plan_id?: string | null
          notes?: string | null
          old_plan_id?: string | null
          payment_type: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          credit_amount?: number | null
          currency?: string | null
          days_remaining?: number | null
          id?: string
          new_plan_id?: string | null
          notes?: string | null
          old_plan_id?: string | null
          payment_type?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_new_plan_id_fkey"
            columns: ["new_plan_id"]
            isOneToOne: false
            referencedRelation: "protection_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_old_plan_id_fkey"
            columns: ["old_plan_id"]
            isOneToOne: false
            referencedRelation: "protection_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "printer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_usage_limits: {
        Row: {
          created_at: string
          id: string
          limit_type: string
          max_count: number
          reset_date: string
          subscription_id: string
          updated_at: string
          used_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          limit_type: string
          max_count: number
          reset_date: string
          subscription_id: string
          updated_at?: string
          used_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          limit_type?: string
          max_count?: number
          reset_date?: string
          subscription_id?: string
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_usage_limits_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "printer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      taobao_sync_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          product_id: string | null
          sync_status: string
          variants_synced: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          product_id?: string | null
          sync_status?: string
          variants_synced?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          product_id?: string | null
          sync_status?: string
          variants_synced?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "taobao_sync_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      user_cards: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          level_id: string
          points_spent: number
          purchased_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          level_id: string
          points_spent?: number
          purchased_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          level_id?: string
          points_spent?: number
          purchased_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cards_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "loyalty_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_collected_letters: {
        Row: {
          collected_at: string | null
          competition_id: string | null
          id: string
          letter: string
          ticket_id: string | null
          user_id: string
        }
        Insert: {
          collected_at?: string | null
          competition_id?: string | null
          id?: string
          letter: string
          ticket_id?: string | null
          user_id: string
        }
        Update: {
          collected_at?: string | null
          competition_id?: string | null
          id?: string
          letter?: string
          ticket_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_collected_letters_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_collected_letters_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "competition_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_coupons: {
        Row: {
          coupon_code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_used: boolean
          source: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          coupon_code: string
          created_at?: string
          discount_type?: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_used?: boolean
          source?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          coupon_code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_used?: boolean
          source?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_listings: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          category_id: string | null
          condition: string
          created_at: string
          currency: string
          description: string | null
          description_ar: string | null
          expires_at: string | null
          id: string
          images: string[] | null
          last_renewed_at: string | null
          likes_count: number | null
          listing_code: string | null
          location: string | null
          original_price: number | null
          price: number
          seller_id: string
          shipping_method: string
          status: string
          title: string
          title_ar: string
          updated_at: string
          views_count: number | null
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          category_id?: string | null
          condition?: string
          created_at?: string
          currency?: string
          description?: string | null
          description_ar?: string | null
          expires_at?: string | null
          id?: string
          images?: string[] | null
          last_renewed_at?: string | null
          likes_count?: number | null
          listing_code?: string | null
          location?: string | null
          original_price?: number | null
          price: number
          seller_id: string
          shipping_method?: string
          status?: string
          title: string
          title_ar: string
          updated_at?: string
          views_count?: number | null
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          category_id?: string | null
          condition?: string
          created_at?: string
          currency?: string
          description?: string | null
          description_ar?: string | null
          expires_at?: string | null
          id?: string
          images?: string[] | null
          last_renewed_at?: string | null
          likes_count?: number | null
          listing_code?: string | null
          location?: string | null
          original_price?: number | null
          price?: number
          seller_id?: string
          shipping_method?: string
          status?: string
          title?: string
          title_ar?: string
          updated_at?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
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
      user_printers: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          store_printer_id: string
          updated_at: string | null
          user_id: string
          verification_status:
            | Database["public"]["Enums"]["printer_verification_status"]
            | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          store_printer_id: string
          updated_at?: string | null
          user_id: string
          verification_status?:
            | Database["public"]["Enums"]["printer_verification_status"]
            | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          store_printer_id?: string
          updated_at?: string | null
          user_id?: string
          verification_status?:
            | Database["public"]["Enums"]["printer_verification_status"]
            | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_printers_store_printer_id_fkey"
            columns: ["store_printer_id"]
            isOneToOne: true
            referencedRelation: "order_items_for_serial"
            referencedColumns: ["store_printer_id"]
          },
          {
            foreignKeyName: "user_printers_store_printer_id_fkey"
            columns: ["store_printer_id"]
            isOneToOne: true
            referencedRelation: "store_printers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_purchased_products: {
        Row: {
          competition_id: string | null
          created_at: string
          currency: string | null
          delivered_at: string | null
          gift_tickets: number
          id: string
          listed_in_marketplace: boolean | null
          marketplace_listing_id: string | null
          order_id: string | null
          order_status: string
          ordered_at: string | null
          product_id: string | null
          product_image: string | null
          product_name: string
          product_name_ar: string
          product_price: number
          purchased_at: string
          shipment_request_id: string | null
          shipped_at: string | null
          source_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          competition_id?: string | null
          created_at?: string
          currency?: string | null
          delivered_at?: string | null
          gift_tickets?: number
          id?: string
          listed_in_marketplace?: boolean | null
          marketplace_listing_id?: string | null
          order_id?: string | null
          order_status?: string
          ordered_at?: string | null
          product_id?: string | null
          product_image?: string | null
          product_name: string
          product_name_ar: string
          product_price?: number
          purchased_at?: string
          shipment_request_id?: string | null
          shipped_at?: string | null
          source_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          competition_id?: string | null
          created_at?: string
          currency?: string | null
          delivered_at?: string | null
          gift_tickets?: number
          id?: string
          listed_in_marketplace?: boolean | null
          marketplace_listing_id?: string | null
          order_id?: string | null
          order_status?: string
          ordered_at?: string | null
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          product_name_ar?: string
          product_price?: number
          purchased_at?: string
          shipment_request_id?: string | null
          shipped_at?: string | null
          source_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_purchased_products_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_purchased_products_marketplace_listing_id_fkey"
            columns: ["marketplace_listing_id"]
            isOneToOne: false
            referencedRelation: "user_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_purchased_products_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_purchased_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_purchased_products_shipment_request_id_fkey"
            columns: ["shipment_request_id"]
            isOneToOne: false
            referencedRelation: "shipment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_redeemed_products: {
        Row: {
          coupon_code: string
          created_at: string
          expires_at: string | null
          id: string
          is_used: boolean | null
          points_spent: number
          product_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          coupon_code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean | null
          points_spent: number
          product_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          coupon_code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean | null
          points_spent?: number
          product_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_redeemed_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "points_redeemable_products"
            referencedColumns: ["id"]
          },
        ]
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
      user_tickets: {
        Row: {
          created_at: string
          id: string
          ticket_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ticket_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ticket_count?: number
          updated_at?: string
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
      user_warnings: {
        Row: {
          admin_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          reason: string
          updated_at: string
          user_id: string
          warning_type: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason: string
          updated_at?: string
          user_id: string
          warning_type?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string
          updated_at?: string
          user_id?: string
          warning_type?: string
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
      order_items_for_serial: {
        Row: {
          model_name: string | null
          order_id: string | null
          order_item_id: string | null
          order_number: string | null
          order_status: string | null
          printer_model_ar: string | null
          product_id: string | null
          product_name: string | null
          product_name_ar: string | null
          quantity: number | null
          serial_number: string | null
          store_printer_id: string | null
          user_id: string | null
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
            foreignKeyName: "order_items_product_id_fkey_products"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_prize_as_product: {
        Args: {
          p_competition_id: string
          p_product_id?: string
          p_product_image: string
          p_product_name: string
          p_product_name_ar: string
          p_product_value?: number
          p_user_id: string
        }
        Returns: string
      }
      add_serial_number_to_order_item: {
        Args: {
          p_admin_id: string
          p_order_item_id: string
          p_serial_number: string
        }
        Returns: Json
      }
      auto_confirm_delivery: { Args: never; Returns: undefined }
      calculate_user_level: { Args: { points: number }; Returns: string }
      check_username_available: {
        Args: { username_to_check: string }
        Returns: boolean
      }
      cleanup_old_coupon_attempts: { Args: never; Returns: undefined }
      complete_daily_task: { Args: { task_key_param: string }; Returns: Json }
      convert_points_to_tickets: {
        Args: { points_amount: number }
        Returns: Json
      }
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
      draw_multiple_winners: { Args: { comp_id: string }; Returns: Json }
      enter_collect_letters_competition:
        | { Args: { comp_id: string }; Returns: Json }
        | { Args: { comp_id: string; quantity?: number }; Returns: Json }
      enter_competition_with_tickets: {
        Args: { comp_id: string }
        Returns: Json
      }
      enter_everyone_wins_competition: {
        Args: { comp_id: string }
        Returns: Json
      }
      enter_free_competition: { Args: { comp_id: string }; Returns: Json }
      enter_instant_win_competition: {
        Args: { comp_id: string }
        Returns: Json
      }
      enter_mystery_box_competition: {
        Args: { comp_id: string }
        Returns: Json
      }
      generate_cart_code: { Args: never; Returns: string }
      generate_conversation_code: { Args: never; Returns: string }
      generate_listing_code: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_referral_code:
        | { Args: never; Returns: string }
        | { Args: { user_username: string }; Returns: string }
      generate_request_code: { Args: never; Returns: string }
      generate_ticket_number: { Args: { comp_id: string }; Returns: string }
      get_user_delivered_printers: {
        Args: { p_user_id: string }
        Returns: {
          delivered_at: string
          is_registered: boolean
          order_id: string
          order_item_id: string
          product_id: string
          product_name: string
          product_name_ar: string
          serial_number: string
          user_printer_id: string
        }[]
      }
      get_user_eligible_printers: {
        Args: { p_user_id: string }
        Returns: {
          delivered_at: string
          has_active_subscription: boolean
          image_url: string
          is_registered: boolean
          is_verified: boolean
          order_id: string
          order_item_id: string
          pending_serial_request: boolean
          product_id: string
          product_name: string
          product_name_ar: string
          serial_number: string
          user_printer_id: string
        }[]
      }
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
      notify_draw_happening: { Args: { comp_id: string }; Returns: undefined }
      purchase_competition_ticket:
        | { Args: { comp_id: string }; Returns: Json }
        | { Args: { comp_id: string; quantity?: number }; Returns: Json }
      purchase_product_offer: {
        Args: { p_offer_id: string; p_quantity?: number }
        Returns: Json
      }
      purchase_product_with_gift_tickets: {
        Args: { p_competition_id: string; p_quantity?: number }
        Returns: Json
      }
      purchase_tickets: {
        Args: { price_per_ticket: number; ticket_quantity: number }
        Returns: Json
      }
      purchase_tickets_with_bonus: {
        Args: {
          bonus_tickets: number
          price_per_ticket: number
          ticket_quantity: number
        }
        Returns: Json
      }
      record_listing_view: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      redeem_letters_prize: {
        Args: { p_competition_id: string; p_word: string }
        Returns: Json
      }
      register_printer_from_order: {
        Args: { p_serial_number: string; p_user_id: string }
        Returns: string
      }
      register_user_printer: {
        Args: { p_serial_number: string; p_user_id: string }
        Returns: string
      }
      request_offer_shipment: {
        Args: { p_purchase_ids: string[] }
        Returns: Json
      }
      request_product_delivery: {
        Args: { p_product_ids: string[] }
        Returns: Json
      }
      send_general_notification: {
        Args: { _message: string; _title: string; _type?: string }
        Returns: undefined
      }
      validate_coupon: { Args: { coupon_code: string }; Returns: Json }
      validate_coupon_with_rate_limit: {
        Args: { coupon_code: string }
        Returns: Json
      }
      verify_printer_serial: {
        Args: { p_serial_number: string }
        Returns: {
          is_available: boolean
          model_name: string
          model_name_ar: string
          store_printer_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "manager" | "worker"
      competition_status: "draft" | "active" | "completed" | "cancelled"
      competition_type:
        | "ticket_count"
        | "all_tickets_sold"
        | "timed"
        | "free"
        | "instant_winner"
        | "everyone_wins"
        | "escalating_price"
        | "mystery_box"
        | "hidden_winner"
        | "team_battle"
        | "flash_sale"
        | "growing_prize"
        | "collect_letters"
      printer_subscription_status: "active" | "paused" | "expired" | "cancelled"
      printer_verification_status: "pending" | "verified" | "rejected"
      protection_plan_type: "basic" | "standard" | "comprehensive"
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
      competition_type: [
        "ticket_count",
        "all_tickets_sold",
        "timed",
        "free",
        "instant_winner",
        "everyone_wins",
        "escalating_price",
        "mystery_box",
        "hidden_winner",
        "team_battle",
        "flash_sale",
        "growing_prize",
        "collect_letters",
      ],
      printer_subscription_status: ["active", "paused", "expired", "cancelled"],
      printer_verification_status: ["pending", "verified", "rejected"],
      protection_plan_type: ["basic", "standard", "comprehensive"],
    },
  },
} as const
