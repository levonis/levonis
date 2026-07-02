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
      ad_watch_log: {
        Row: {
          created_at: string
          id: string
          session_id: string
          ticket_awarded: boolean
          user_id: string
          watch_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          ticket_awarded?: boolean
          user_id: string
          watch_number?: number
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          ticket_awarded?: boolean
          user_id?: string
          watch_number?: number
        }
        Relationships: []
      }
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
      announcement_settings: {
        Row: {
          always_move: boolean
          auto_rotate: boolean
          color: string
          created_at: string
          direction: string
          display_duration: number
          gap: number
          id: string
          is_singleton: boolean
          speed: number
          updated_at: string
        }
        Insert: {
          always_move?: boolean
          auto_rotate?: boolean
          color?: string
          created_at?: string
          direction?: string
          display_duration?: number
          gap?: number
          id?: string
          is_singleton?: boolean
          speed?: number
          updated_at?: string
        }
        Update: {
          always_move?: boolean
          auto_rotate?: boolean
          color?: string
          created_at?: string
          direction?: string
          display_duration?: number
          gap?: number
          id?: string
          is_singleton?: boolean
          speed?: number
          updated_at?: string
        }
        Relationships: []
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
          message_en: string | null
          message_ku: string | null
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
          message_en?: string | null
          message_ku?: string | null
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
          message_en?: string | null
          message_ku?: string | null
          speed?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_versions: {
        Row: {
          created_at: string
          download_url: string
          file_size_mb: number | null
          id: string
          is_active: boolean
          is_latest: boolean
          min_android_version: string | null
          platform: string
          release_notes_ar: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          download_url: string
          file_size_mb?: number | null
          id?: string
          is_active?: boolean
          is_latest?: boolean
          min_android_version?: string | null
          platform?: string
          release_notes_ar?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          download_url?: string
          file_size_mb?: number | null
          id?: string
          is_active?: boolean
          is_latest?: boolean
          min_android_version?: string | null
          platform?: string
          release_notes_ar?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      assistance_coupon_claims: {
        Row: {
          coupon_code: string
          coupon_id: string
          created_at: string
          id: string
          is_used: boolean
          user_id: string
        }
        Insert: {
          coupon_code: string
          coupon_id: string
          created_at?: string
          id?: string
          is_used?: boolean
          user_id: string
        }
        Update: {
          coupon_code?: string
          coupon_id?: string
          created_at?: string
          id?: string
          is_used?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistance_coupon_claims_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "assistance_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      assistance_coupons: {
        Row: {
          claimed_count: number
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_claims: number
          title_ar: string
          title_en: string | null
          title_ku: string | null
          valid_until: string | null
        }
        Insert: {
          claimed_count?: number
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_claims?: number
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          valid_until?: string | null
        }
        Update: {
          claimed_count?: number
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_claims?: number
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      assistance_envelope_claims: {
        Row: {
          created_at: string
          envelope_id: string
          id: string
          remaining_discount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          envelope_id: string
          id?: string
          remaining_discount?: number
          user_id: string
        }
        Update: {
          created_at?: string
          envelope_id?: string
          id?: string
          remaining_discount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistance_envelope_claims_envelope_id_fkey"
            columns: ["envelope_id"]
            isOneToOne: false
            referencedRelation: "assistance_red_envelopes"
            referencedColumns: ["id"]
          },
        ]
      }
      assistance_gift_claims: {
        Row: {
          created_at: string
          gift_id: string
          id: string
          is_redeemed: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          gift_id: string
          id?: string
          is_redeemed?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          gift_id?: string
          id?: string
          is_redeemed?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistance_gift_claims_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "assistance_gifts"
            referencedColumns: ["id"]
          },
        ]
      }
      assistance_gifts: {
        Row: {
          claimed_count: number
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          id: string
          image_url: string | null
          is_active: boolean
          max_claims: number
          product_id: string | null
          title_ar: string
          title_en: string | null
          title_ku: string | null
        }
        Insert: {
          claimed_count?: number
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_claims?: number
          product_id?: string | null
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
        }
        Update: {
          claimed_count?: number
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_claims?: number
          product_id?: string | null
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
        }
        Relationships: []
      }
      assistance_red_envelopes: {
        Row: {
          claimed_count: number
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          discount_amount: number
          id: string
          is_active: boolean
          is_limited: boolean
          max_claims: number | null
          max_discount: number
          spend_threshold: number
          title_ar: string
          title_en: string | null
          title_ku: string | null
        }
        Insert: {
          claimed_count?: number
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          discount_amount?: number
          id?: string
          is_active?: boolean
          is_limited?: boolean
          max_claims?: number | null
          max_discount?: number
          spend_threshold?: number
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
        }
        Update: {
          claimed_count?: number
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          discount_amount?: number
          id?: string
          is_active?: boolean
          is_limited?: boolean
          max_claims?: number | null
          max_discount?: number
          spend_threshold?: number
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
        }
        Relationships: []
      }
      avatar_frames: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          image_url: string
          is_active: boolean
          is_free: boolean
          name_ar: string
          name_en: string | null
          name_ku: string | null
          points_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          image_url: string
          is_active?: boolean
          is_free?: boolean
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          points_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          image_url?: string
          is_active?: boolean
          is_free?: boolean
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          points_cost?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      balance_audit_log: {
        Row: {
          change_amount: number | null
          created_at: string | null
          function_name: string | null
          id: string
          ip_address: string | null
          new_balance: number | null
          old_balance: number | null
          operation: string
          table_name: string
          user_id: string
        }
        Insert: {
          change_amount?: number | null
          created_at?: string | null
          function_name?: string | null
          id?: string
          ip_address?: string | null
          new_balance?: number | null
          old_balance?: number | null
          operation: string
          table_name: string
          user_id: string
        }
        Update: {
          change_amount?: number | null
          created_at?: string | null
          function_name?: string | null
          id?: string
          ip_address?: string | null
          new_balance?: number | null
          old_balance?: number | null
          operation?: string
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          action_type: string
          button_text: string | null
          button_text_ar: string | null
          button_text_en: string | null
          button_text_ku: string | null
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
          title_en: string | null
          title_ku: string | null
          updated_at: string
        }
        Insert: {
          action_type?: string
          button_text?: string | null
          button_text_ar?: string | null
          button_text_en?: string | null
          button_text_ku?: string | null
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
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          button_text?: string | null
          button_text_ar?: string | null
          button_text_en?: string | null
          button_text_ku?: string | null
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
          title_en?: string | null
          title_ku?: string | null
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
      bundle_items: {
        Row: {
          bundle_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          selected_color: string | null
          selected_option_id: string | null
        }
        Insert: {
          bundle_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          selected_color?: string | null
          selected_option_id?: string | null
        }
        Update: {
          bundle_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          selected_color?: string | null
          selected_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "product_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "product_options_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      card_discount_limits: {
        Row: {
          card_id: string
          category_id: string
          created_at: string
          id: string
          max_uses: number
          updated_at: string
        }
        Insert: {
          card_id: string
          category_id: string
          created_at?: string
          id?: string
          max_uses?: number
          updated_at?: string
        }
        Update: {
          card_id?: string
          category_id?: string
          created_at?: string
          id?: string
          max_uses?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_discount_limits_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "membership_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_discount_limits_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      card_discount_usage: {
        Row: {
          card_id: string
          category_id: string
          id: string
          order_id: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          category_id: string
          id?: string
          order_id?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          category_id?: string
          id?: string
          order_id?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_discount_usage_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "user_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_discount_usage_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      card_exclusive_offers: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          id: string
          image_url: string | null
          is_active: boolean
          min_card_id: string | null
          offer_type: string
          offer_value: number | null
          title_ar: string
          title_en: string | null
          title_ku: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_card_id?: string | null
          offer_type?: string
          offer_value?: number | null
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_card_id?: string | null
          offer_type?: string
          offer_value?: number | null
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_exclusive_offers_min_card_id_fkey"
            columns: ["min_card_id"]
            isOneToOne: false
            referencedRelation: "membership_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_gifts: {
        Row: {
          amount_paid: number
          card_id: string | null
          card_target_id: string
          created_at: string
          gifter_id: string
          id: string
          message: string | null
          payment_method: string
          recipient_id: string
        }
        Insert: {
          amount_paid?: number
          card_id?: string | null
          card_target_id: string
          created_at?: string
          gifter_id: string
          id?: string
          message?: string | null
          payment_method?: string
          recipient_id: string
        }
        Update: {
          amount_paid?: number
          card_id?: string | null
          card_target_id?: string
          created_at?: string
          gifter_id?: string
          id?: string
          message?: string | null
          payment_method?: string
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_gifts_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "user_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_gifts_card_target_id_fkey"
            columns: ["card_target_id"]
            isOneToOne: false
            referencedRelation: "membership_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_insurance_addons: {
        Row: {
          cart_item_id: string
          coverage_months: number
          created_at: string
          id: string
          plan_id: string
          price_iqd: number
          printer_product_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cart_item_id: string
          coverage_months: number
          created_at?: string
          id?: string
          plan_id: string
          price_iqd: number
          printer_product_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cart_item_id?: string
          coverage_months?: number
          created_at?: string
          id?: string
          plan_id?: string
          price_iqd?: number
          printer_product_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_insurance_addons_cart_item_id_fkey"
            columns: ["cart_item_id"]
            isOneToOne: true
            referencedRelation: "cart_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_insurance_addons_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "protection_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_insurance_addons_printer_product_id_fkey"
            columns: ["printer_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          bundle_id: string | null
          color_image_url: string | null
          created_at: string | null
          custom_request_id: string | null
          id: string
          is_gift: boolean
          is_locked: boolean
          offer_purchase_id: string | null
          option_image_url: string | null
          product_id: string | null
          product_option_id: string | null
          quantity: number
          rf_category_id: string | null
          rf_offer_id: string | null
          sale_type: string | null
          selected_color: string | null
          shipping_option_index: number | null
          shipping_option_name_ar: string | null
          shipping_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bundle_id?: string | null
          color_image_url?: string | null
          created_at?: string | null
          custom_request_id?: string | null
          id?: string
          is_gift?: boolean
          is_locked?: boolean
          offer_purchase_id?: string | null
          option_image_url?: string | null
          product_id?: string | null
          product_option_id?: string | null
          quantity?: number
          rf_category_id?: string | null
          rf_offer_id?: string | null
          sale_type?: string | null
          selected_color?: string | null
          shipping_option_index?: number | null
          shipping_option_name_ar?: string | null
          shipping_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bundle_id?: string | null
          color_image_url?: string | null
          created_at?: string | null
          custom_request_id?: string | null
          id?: string
          is_gift?: boolean
          is_locked?: boolean
          offer_purchase_id?: string | null
          option_image_url?: string | null
          product_id?: string | null
          product_option_id?: string | null
          quantity?: number
          rf_category_id?: string | null
          rf_offer_id?: string | null
          sale_type?: string | null
          selected_color?: string | null
          shipping_option_index?: number | null
          shipping_option_name_ar?: string | null
          shipping_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "product_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_custom_request_id_fkey"
            columns: ["custom_request_id"]
            isOneToOne: false
            referencedRelation: "custom_product_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_offer_purchase_id_fkey"
            columns: ["offer_purchase_id"]
            isOneToOne: false
            referencedRelation: "product_offer_purchases"
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
          {
            foreignKeyName: "cart_items_product_option_id_fkey"
            columns: ["product_option_id"]
            isOneToOne: false
            referencedRelation: "product_options_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_rf_category_id_fkey"
            columns: ["rf_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_rf_offer_id_fkey"
            columns: ["rf_offer_id"]
            isOneToOne: false
            referencedRelation: "random_filament_offers"
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
          description_en: string | null
          description_ku: string | null
          featured_product_id: string | null
          icon: string
          id: string
          main_section_id: string | null
          media_chroma: string
          media_chroma_key: string | null
          media_transparent: boolean
          media_type: string | null
          media_url: string | null
          name: string
          name_ar: string
          name_en: string | null
          name_ku: string | null
          slug: string
          tax_rate: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          featured_product_id?: string | null
          icon: string
          id?: string
          main_section_id?: string | null
          media_chroma?: string
          media_chroma_key?: string | null
          media_transparent?: boolean
          media_type?: string | null
          media_url?: string | null
          name: string
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          slug: string
          tax_rate?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          featured_product_id?: string | null
          icon?: string
          id?: string
          main_section_id?: string | null
          media_chroma?: string
          media_chroma_key?: string | null
          media_transparent?: boolean
          media_type?: string | null
          media_url?: string | null
          name?: string
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          slug?: string
          tax_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_featured_product_id_fkey"
            columns: ["featured_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_main_section_id_fkey"
            columns: ["main_section_id"]
            isOneToOne: false
            referencedRelation: "main_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_order_modifications: {
        Row: {
          change_type: string
          created_at: string
          id: string
          new_value: string
          old_value: string
          order_id: string
          seller_note: string | null
          status: string
        }
        Insert: {
          change_type?: string
          created_at?: string
          id?: string
          new_value: string
          old_value: string
          order_id: string
          seller_note?: string | null
          status?: string
        }
        Update: {
          change_type?: string
          created_at?: string
          id?: string
          new_value?: string
          old_value?: string
          order_id?: string
          seller_note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_order_modifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "chat_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_orders: {
        Row: {
          checkout_completed_at: string | null
          commission_amount: number | null
          commission_rate: number | null
          conversation_id: string
          created_at: string
          customer_id: string
          delivery_address_id: string | null
          delivery_notes: string | null
          description: string | null
          id: string
          notes: string | null
          paid_amount: number | null
          partial_payment_percent: number | null
          payment_method: string | null
          product_id: string | null
          product_image: string | null
          product_title: string
          quantity: number
          remaining_amount: number | null
          seller_id: string
          status: string
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          checkout_completed_at?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          conversation_id: string
          created_at?: string
          customer_id: string
          delivery_address_id?: string | null
          delivery_notes?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          partial_payment_percent?: number | null
          payment_method?: string | null
          product_id?: string | null
          product_image?: string | null
          product_title: string
          quantity?: number
          remaining_amount?: number | null
          seller_id: string
          status?: string
          total_price: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          checkout_completed_at?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          conversation_id?: string
          created_at?: string
          customer_id?: string
          delivery_address_id?: string | null
          delivery_notes?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          partial_payment_percent?: number | null
          payment_method?: string | null
          product_id?: string | null
          product_image?: string | null
          product_title?: string
          quantity?: number
          remaining_amount?: number | null
          seller_id?: string
          status?: string
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_orders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "listing_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "user_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      chunk_load_errors: {
        Row: {
          asset_url: string | null
          created_at: string
          downlink: number | null
          error_type: string | null
          id: string
          is_mobile: boolean | null
          language: string | null
          message: string | null
          ms_since_load: number | null
          network_type: string | null
          platform: string | null
          recovery_attempts: number | null
          referrer: string | null
          rtt: number | null
          save_data: boolean | null
          url: string | null
          user_agent: string | null
          user_id: string | null
          viewport_height: number | null
          viewport_width: number | null
        }
        Insert: {
          asset_url?: string | null
          created_at?: string
          downlink?: number | null
          error_type?: string | null
          id?: string
          is_mobile?: boolean | null
          language?: string | null
          message?: string | null
          ms_since_load?: number | null
          network_type?: string | null
          platform?: string | null
          recovery_attempts?: number | null
          referrer?: string | null
          rtt?: number | null
          save_data?: boolean | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Update: {
          asset_url?: string | null
          created_at?: string
          downlink?: number | null
          error_type?: string | null
          id?: string
          is_mobile?: boolean | null
          language?: string | null
          message?: string | null
          ms_since_load?: number | null
          network_type?: string | null
          platform?: string | null
          recovery_attempts?: number | null
          referrer?: string | null
          rtt?: number | null
          save_data?: boolean | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Relationships: []
      }
      client_error_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          source: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          source: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      community_cart_items: {
        Row: {
          created_at: string
          discount_id: string | null
          id: string
          merchant_id: string
          merchant_name: string | null
          notes: string | null
          product_id: string
          product_image: string | null
          product_price: number
          product_title: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_id?: string | null
          id?: string
          merchant_id: string
          merchant_name?: string | null
          notes?: string | null
          product_id: string
          product_image?: string | null
          product_price?: number
          product_title: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discount_id?: string | null
          id?: string
          merchant_id?: string
          merchant_name?: string | null
          notes?: string | null
          product_id?: string
          product_image?: string | null
          product_price?: number
          product_title?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_cart_items_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "merchant_store_discounts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_categories: {
        Row: {
          created_at: string
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_hidden: boolean
          parent_id: string | null
          target_id: string
          target_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          parent_id?: string | null
          target_id: string
          target_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          parent_id?: string | null
          target_id?: string
          target_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_complaints: {
        Row: {
          admin_notes: string | null
          complainant_id: string
          complaint_type: string
          created_at: string
          description: string
          id: string
          images: string[] | null
          offer_id: string | null
          priority: string | null
          reported_merchant_id: string | null
          reported_user_id: string | null
          request_id: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          complainant_id: string
          complaint_type?: string
          created_at?: string
          description: string
          id?: string
          images?: string[] | null
          offer_id?: string | null
          priority?: string | null
          reported_merchant_id?: string | null
          reported_user_id?: string | null
          request_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          complainant_id?: string
          complaint_type?: string
          created_at?: string
          description?: string
          id?: string
          images?: string[] | null
          offer_id?: string | null
          priority?: string | null
          reported_merchant_id?: string | null
          reported_user_id?: string | null
          request_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_complaints_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "community_print_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_complaints_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "community_print_requests_public"
            referencedColumns: ["id"]
          },
        ]
      }
      community_customer_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          frame_url: string | null
          id: string
          is_suspended: boolean | null
          is_verified: boolean | null
          reputation_score: number | null
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          total_requests_made: number | null
          total_requests_received: number | null
          total_spent: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          frame_url?: string | null
          id?: string
          is_suspended?: boolean | null
          is_verified?: boolean | null
          reputation_score?: number | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          total_requests_made?: number | null
          total_requests_received?: number | null
          total_spent?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          frame_url?: string | null
          id?: string
          is_suspended?: boolean | null
          is_verified?: boolean | null
          reputation_score?: number | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          total_requests_made?: number | null
          total_requests_received?: number | null
          total_spent?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_likes: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      community_print_requests: {
        Row: {
          accepted_at: string | null
          accepted_offer_id: string | null
          admin_notes: string | null
          auto_confirmed_at: string | null
          colors: string
          created_at: string
          customer_address_id: string | null
          customer_confirmed_at: string | null
          customer_governorate: string | null
          delivered_at: string | null
          description: string
          difficulty: string | null
          escrow_amount: number | null
          escrow_held_at: string | null
          estimated_price_max: number | null
          estimated_price_min: number | null
          estimated_print_minutes: number | null
          estimated_weight_g: number | null
          id: string
          image_url: string | null
          images: string[] | null
          material_type: string | null
          merchant_paid_amount: number | null
          merchant_paid_at: string | null
          notes: string | null
          payment_commission_amount: number | null
          payment_commission_rate: number | null
          payment_method: string | null
          quantity: number | null
          quote_breakdown: Json | null
          quote_source: string | null
          quote_url: string | null
          reference_links: string[] | null
          size: string
          status: string
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_offer_id?: string | null
          admin_notes?: string | null
          auto_confirmed_at?: string | null
          colors: string
          created_at?: string
          customer_address_id?: string | null
          customer_confirmed_at?: string | null
          customer_governorate?: string | null
          delivered_at?: string | null
          description: string
          difficulty?: string | null
          escrow_amount?: number | null
          escrow_held_at?: string | null
          estimated_price_max?: number | null
          estimated_price_min?: number | null
          estimated_print_minutes?: number | null
          estimated_weight_g?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          material_type?: string | null
          merchant_paid_amount?: number | null
          merchant_paid_at?: string | null
          notes?: string | null
          payment_commission_amount?: number | null
          payment_commission_rate?: number | null
          payment_method?: string | null
          quantity?: number | null
          quote_breakdown?: Json | null
          quote_source?: string | null
          quote_url?: string | null
          reference_links?: string[] | null
          size: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_offer_id?: string | null
          admin_notes?: string | null
          auto_confirmed_at?: string | null
          colors?: string
          created_at?: string
          customer_address_id?: string | null
          customer_confirmed_at?: string | null
          customer_governorate?: string | null
          delivered_at?: string | null
          description?: string
          difficulty?: string | null
          escrow_amount?: number | null
          escrow_held_at?: string | null
          estimated_price_max?: number | null
          estimated_price_min?: number | null
          estimated_print_minutes?: number | null
          estimated_weight_g?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          material_type?: string | null
          merchant_paid_amount?: number | null
          merchant_paid_at?: string | null
          notes?: string | null
          payment_commission_amount?: number | null
          payment_commission_rate?: number | null
          payment_method?: string | null
          quantity?: number | null
          quote_breakdown?: Json | null
          quote_source?: string | null
          quote_url?: string | null
          reference_links?: string[] | null
          size?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_print_requests_accepted_offer_id_fkey"
            columns: ["accepted_offer_id"]
            isOneToOne: false
            referencedRelation: "print_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_print_requests_customer_address_id_fkey"
            columns: ["customer_address_id"]
            isOneToOne: false
            referencedRelation: "user_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      community_rate_limits: {
        Row: {
          action_count: number | null
          action_type: string
          created_at: string | null
          id: string
          user_id: string
          window_start: string | null
        }
        Insert: {
          action_count?: number | null
          action_type: string
          created_at?: string | null
          id?: string
          user_id: string
          window_start?: string | null
        }
        Update: {
          action_count?: number | null
          action_type?: string
          created_at?: string | null
          id?: string
          user_id?: string
          window_start?: string | null
        }
        Relationships: []
      }
      community_security_log: {
        Row: {
          action_type: string
          created_at: string | null
          details: Json | null
          id: string
          ip_hash: string | null
          severity: string | null
          target_id: string | null
          target_table: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_hash?: string | null
          severity?: string | null
          target_id?: string | null
          target_table?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_hash?: string | null
          severity?: string | null
          target_id?: string | null
          target_table?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      community_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      competition_entry_log: {
        Row: {
          competition_id: string
          created_at: string | null
          error_message: string | null
          id: string
          ip_hash: string | null
          success: boolean | null
          tickets_deducted: number | null
          tickets_requested: number
          user_balance_after: number | null
          user_balance_before: number | null
          user_id: string
        }
        Insert: {
          competition_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          ip_hash?: string | null
          success?: boolean | null
          tickets_deducted?: number | null
          tickets_requested: number
          user_balance_after?: number | null
          user_balance_before?: number | null
          user_id: string
        }
        Update: {
          competition_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          ip_hash?: string | null
          success?: boolean | null
          tickets_deducted?: number | null
          tickets_requested?: number
          user_balance_after?: number | null
          user_balance_before?: number | null
          user_id?: string
        }
        Relationships: []
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
          conversation_type: string
          created_at: string
          id: string
          last_message_at: string | null
          order_id: string | null
          status: string
          technician_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_type?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          status?: string
          technician_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_type?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          status?: string
          technician_id?: string | null
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
          {
            foreignKeyName: "conversations_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "maintenance_technicians"
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
          applicable_delivery_method: string | null
          applies_to_levo_card_only: boolean
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
          applicable_delivery_method?: string | null
          applies_to_levo_card_only?: boolean
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
          applicable_delivery_method?: string | null
          applies_to_levo_card_only?: boolean
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
      crossy_road_high_scores: {
        Row: {
          all_time_high_score: number | null
          best_steps: number
          high_score: number
          id: string
          season: number
          updated_at: string
          user_id: string
        }
        Insert: {
          all_time_high_score?: number | null
          best_steps?: number
          high_score?: number
          id?: string
          season?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          all_time_high_score?: number | null
          best_steps?: number
          high_score?: number
          id?: string
          season?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crossy_road_leaderboard_prizes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          position: number
          prize_name_ar: string
          product_id: string | null
          selected_color: string | null
          selected_option_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          position: number
          prize_name_ar?: string
          product_id?: string | null
          selected_color?: string | null
          selected_option_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          prize_name_ar?: string
          product_id?: string | null
          selected_color?: string | null
          selected_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crossy_road_leaderboard_prizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossy_road_leaderboard_prizes_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossy_road_leaderboard_prizes_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "product_options_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      crossy_road_milestone_claims: {
        Row: {
          claimed_at: string
          id: string
          milestone_id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          milestone_id: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          milestone_id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crossy_road_milestone_claims_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "crossy_road_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossy_road_milestone_claims_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "crossy_road_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      crossy_road_milestones: {
        Row: {
          claimed_count: number
          created_at: string
          id: string
          is_active: boolean
          prize_name_ar: string
          product_id: string | null
          selected_color: string | null
          selected_option_id: string | null
          stock: number
          target_score: number
        }
        Insert: {
          claimed_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          prize_name_ar?: string
          product_id?: string | null
          selected_color?: string | null
          selected_option_id?: string | null
          stock?: number
          target_score: number
        }
        Update: {
          claimed_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          prize_name_ar?: string
          product_id?: string | null
          selected_color?: string | null
          selected_option_id?: string | null
          stock?: number
          target_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "crossy_road_milestones_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossy_road_milestones_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossy_road_milestones_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "product_options_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      crossy_road_sessions: {
        Row: {
          coins_collected: number
          ended_at: string | null
          id: string
          points_awarded: number
          score: number
          session_token: string
          started_at: string
          status: string
          steps_taken: number
          user_id: string
        }
        Insert: {
          coins_collected?: number
          ended_at?: string | null
          id?: string
          points_awarded?: number
          score?: number
          session_token?: string
          started_at?: string
          status?: string
          steps_taken?: number
          user_id: string
        }
        Update: {
          coins_collected?: number
          ended_at?: string | null
          id?: string
          points_awarded?: number
          score?: number
          session_token?: string
          started_at?: string
          status?: string
          steps_taken?: number
          user_id?: string
        }
        Relationships: []
      }
      crossy_road_settings: {
        Row: {
          bonus_coin_points: number
          created_at: string
          entry_fee_tickets: number
          game_enabled: boolean
          id: string
          max_daily_plays: number | null
          max_daily_points: number | null
          points_per_step: number
          score_per_coin: number | null
          score_per_step: number | null
          season_ends_at: string | null
          season_name: string | null
          season_starts_at: string | null
          total_plays: number
          total_points_distributed: number
          updated_at: string
        }
        Insert: {
          bonus_coin_points?: number
          created_at?: string
          entry_fee_tickets?: number
          game_enabled?: boolean
          id?: string
          max_daily_plays?: number | null
          max_daily_points?: number | null
          points_per_step?: number
          score_per_coin?: number | null
          score_per_step?: number | null
          season_ends_at?: string | null
          season_name?: string | null
          season_starts_at?: string | null
          total_plays?: number
          total_points_distributed?: number
          updated_at?: string
        }
        Update: {
          bonus_coin_points?: number
          created_at?: string
          entry_fee_tickets?: number
          game_enabled?: boolean
          id?: string
          max_daily_plays?: number | null
          max_daily_points?: number | null
          points_per_step?: number
          score_per_coin?: number | null
          score_per_step?: number | null
          season_ends_at?: string | null
          season_name?: string | null
          season_starts_at?: string | null
          total_plays?: number
          total_points_distributed?: number
          updated_at?: string
        }
        Relationships: []
      }
      crossy_road_winners: {
        Row: {
          awarded_at: string
          id: string
          position: number | null
          prize_name_ar: string
          prize_type: string
          product_id: string | null
          score: number | null
          season: number | null
          selected_color: string | null
          selected_option_id: string | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          id?: string
          position?: number | null
          prize_name_ar?: string
          prize_type?: string
          product_id?: string | null
          score?: number | null
          season?: number | null
          selected_color?: string | null
          selected_option_id?: string | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          id?: string
          position?: number | null
          prize_name_ar?: string
          prize_type?: string
          product_id?: string | null
          score?: number | null
          season?: number | null
          selected_color?: string | null
          selected_option_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crossy_road_winners_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossy_road_winners_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossy_road_winners_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "product_options_admin"
            referencedColumns: ["id"]
          },
        ]
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
      customer_special_coupons: {
        Row: {
          coupon_code: string | null
          coupon_type: string
          created_at: string
          current_uses: number | null
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          discount_value: number | null
          id: string
          image_url: string | null
          is_active: boolean
          max_uses: number | null
          merchant_store_id: string | null
          merchant_store_name: string | null
          product_id: string | null
          title_ar: string
          title_en: string | null
          title_ku: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          coupon_code?: string | null
          coupon_type?: string
          created_at?: string
          current_uses?: number | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          discount_value?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_uses?: number | null
          merchant_store_id?: string | null
          merchant_store_name?: string | null
          product_id?: string | null
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          coupon_code?: string | null
          coupon_type?: string
          created_at?: string
          current_uses?: number | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          discount_value?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_uses?: number | null
          merchant_store_id?: string | null
          merchant_store_name?: string | null
          product_id?: string | null
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_special_coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
          description_en: string | null
          description_ku: string | null
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
          title_en: string | null
          title_ku: string | null
          updated_at: string
        }
        Insert: {
          confirmation_type?: string | null
          created_at?: string
          description_ar: string
          description_en?: string | null
          description_ku?: string | null
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
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Update: {
          confirmation_type?: string | null
          created_at?: string
          description_ar?: string
          description_en?: string | null
          description_ku?: string | null
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
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      default_settings: {
        Row: {
          created_at: string
          id: string
          levo_physical_card_product_id: string | null
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          levo_physical_card_product_id?: string | null
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          levo_physical_card_product_id?: string | null
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      delivery_category_exceptions: {
        Row: {
          category_id: string
          created_at: string
          delivery_method_key: string
          delivery_price: number
          governorate: string | null
          id: string
          units_per_delivery: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          delivery_method_key?: string
          delivery_price?: number
          governorate?: string | null
          id?: string
          units_per_delivery?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          delivery_method_key?: string
          delivery_price?: number
          governorate?: string | null
          id?: string
          units_per_delivery?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_category_exceptions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_governorate_exceptions: {
        Row: {
          created_at: string
          delivery_method_key: string
          delivery_price: number
          governorate: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_method_key?: string
          delivery_price?: number
          governorate: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_method_key?: string
          delivery_price?: number
          governorate?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_methods: {
        Row: {
          actual_cost: number
          base_price: number
          base_price_category_id: string | null
          base_price_units_per_delivery: number
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          display_order: number
          free_delivery_enabled: boolean
          free_delivery_min_order: number
          icon: string | null
          id: string
          is_active: boolean
          method_key: string
          name_ar: string
          name_en: string | null
          name_ku: string | null
          updated_at: string
        }
        Insert: {
          actual_cost?: number
          base_price?: number
          base_price_category_id?: string | null
          base_price_units_per_delivery?: number
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number
          free_delivery_enabled?: boolean
          free_delivery_min_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          method_key: string
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          updated_at?: string
        }
        Update: {
          actual_cost?: number
          base_price?: number
          base_price_category_id?: string | null
          base_price_units_per_delivery?: number
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number
          free_delivery_enabled?: boolean
          free_delivery_min_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          method_key?: string
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_methods_base_price_category_id_fkey"
            columns: ["base_price_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      donations_log: {
        Row: {
          amount: number
          created_at: string
          currency: string
          display_name: string | null
          id: string
          order_id: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          order_id?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          order_id?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      email_verification_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          type: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          type?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          type?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      engineer_ratings: {
        Row: {
          comment: string | null
          created_at: string
          engineer_id: string | null
          engineer_name: string
          id: string
          rating: number
          ticket_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          engineer_id?: string | null
          engineer_name: string
          id?: string
          rating: number
          ticket_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          engineer_id?: string | null
          engineer_name?: string
          id?: string
          rating?: number
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineer_ratings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_transactions: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          held_at: string
          id: string
          merchant_id: string
          merchant_payout: number
          offer_id: string
          platform_fee: number
          refunded_at: string | null
          released_at: string | null
          request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          held_at?: string
          id?: string
          merchant_id: string
          merchant_payout?: number
          offer_id: string
          platform_fee?: number
          refunded_at?: string | null
          released_at?: string | null
          request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          held_at?: string
          id?: string
          merchant_id?: string
          merchant_payout?: number
          offer_id?: string
          platform_fee?: number
          refunded_at?: string | null
          released_at?: string | null
          request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "print_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "community_print_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "community_print_requests_public"
            referencedColumns: ["id"]
          },
        ]
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
      filament_discount_usage: {
        Row: {
          discount_amount: number | null
          id: string
          product_id: string | null
          subscription_id: string | null
          used_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          discount_amount?: number | null
          id?: string
          product_id?: string | null
          subscription_id?: string | null
          used_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          discount_amount?: number | null
          id?: string
          product_id?: string | null
          subscription_id?: string | null
          used_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "filament_discount_usage_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "printer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_drafts: {
        Row: {
          columns: Json
          created_at: string
          created_by: string
          id: string
          rows: Json
          title: string
          updated_at: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          created_by: string
          id?: string
          rows?: Json
          title?: string
          updated_at?: string
        }
        Update: {
          columns?: Json
          created_at?: string
          created_by?: string
          id?: string
          rows?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      future_shipments: {
        Row: {
          created_at: string
          draft_id: string | null
          id: string
          items: Json | null
          merged_at: string | null
          note: string | null
          product_id: string
          quantity: number
          status: string
          total_cost: number
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          draft_id?: string | null
          id?: string
          items?: Json | null
          merged_at?: string | null
          note?: string | null
          product_id: string
          quantity: number
          status?: string
          total_cost?: number
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          draft_id?: string | null
          id?: string
          items?: Json | null
          merged_at?: string | null
          note?: string | null
          product_id?: string
          quantity?: number
          status?: string
          total_cost?: number
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "future_shipments_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "purchase_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "future_shipments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_advice_cards: {
        Row: {
          content: string
          content_ar: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          rarity_tier_id: string | null
          title: string
          title_ar: string
          title_en: string | null
          title_ku: string | null
          updated_at: string
        }
        Insert: {
          content: string
          content_ar: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          rarity_tier_id?: string | null
          title: string
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          content_ar?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          rarity_tier_id?: string | null
          title?: string
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_advice_cards_rarity_tier_id_fkey"
            columns: ["rarity_tier_id"]
            isOneToOne: false
            referencedRelation: "gacha_rarity_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_coupons: {
        Row: {
          coupon_type: string
          created_at: string
          description: string | null
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          image_url: string | null
          is_active: boolean
          max_uses_per_user: number | null
          min_purchase: number | null
          title: string
          title_ar: string
          title_en: string | null
          title_ku: string | null
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          coupon_type?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_uses_per_user?: number | null
          min_purchase?: number | null
          title: string
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          coupon_type?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_uses_per_user?: number | null
          min_purchase?: number | null
          title?: string
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: []
      }
      gacha_dolls: {
        Row: {
          base_price: number
          collection_category: string | null
          created_at: string
          current_price: number
          demand_score: number
          description: string | null
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          doll_number: number
          id: string
          image_url: string | null
          is_limited: boolean
          is_seasonal: boolean
          is_tradable: boolean
          model_url: string | null
          name: string
          name_ar: string
          name_en: string | null
          name_ku: string | null
          rarity_tier_id: string | null
          season_tag: string | null
          supply_count: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          collection_category?: string | null
          created_at?: string
          current_price?: number
          demand_score?: number
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          doll_number: number
          id?: string
          image_url?: string | null
          is_limited?: boolean
          is_seasonal?: boolean
          is_tradable?: boolean
          model_url?: string | null
          name: string
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          rarity_tier_id?: string | null
          season_tag?: string | null
          supply_count?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          collection_category?: string | null
          created_at?: string
          current_price?: number
          demand_score?: number
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          doll_number?: number
          id?: string
          image_url?: string | null
          is_limited?: boolean
          is_seasonal?: boolean
          is_tradable?: boolean
          model_url?: string | null
          name?: string
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          rarity_tier_id?: string | null
          season_tag?: string | null
          supply_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_dolls_rarity_tier_id_fkey"
            columns: ["rarity_tier_id"]
            isOneToOne: false
            referencedRelation: "gacha_rarity_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_guaranteed_claims: {
        Row: {
          claim_count: number
          created_at: string
          id: string
          machine_id: string
          rule_id: string
          user_id: string
        }
        Insert: {
          claim_count?: number
          created_at?: string
          id?: string
          machine_id: string
          rule_id: string
          user_id: string
        }
        Update: {
          claim_count?: number
          created_at?: string
          id?: string
          machine_id?: string
          rule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_guaranteed_claims_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "gacha_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_guaranteed_claims_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "gacha_guaranteed_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_guaranteed_rules: {
        Row: {
          condition_type: string
          condition_value: number
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          is_repeatable: boolean
          machine_id: string
          new_users_only: boolean
          per_user_limit: number | null
          priority_order: number
          reward_image_url: string | null
          reward_name: string
          reward_name_ar: string
          reward_ref_id: string | null
          reward_type: string
          rule_name: string
          rule_name_ar: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          condition_type: string
          condition_value?: number
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_repeatable?: boolean
          machine_id: string
          new_users_only?: boolean
          per_user_limit?: number | null
          priority_order?: number
          reward_image_url?: string | null
          reward_name: string
          reward_name_ar: string
          reward_ref_id?: string | null
          reward_type: string
          rule_name: string
          rule_name_ar: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          condition_type?: string
          condition_value?: number
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_repeatable?: boolean
          machine_id?: string
          new_users_only?: boolean
          per_user_limit?: number | null
          priority_order?: number
          reward_image_url?: string | null
          reward_name?: string
          reward_name_ar?: string
          reward_ref_id?: string | null
          reward_type?: string
          rule_name?: string
          rule_name_ar?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_guaranteed_rules_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "gacha_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_machine_prizes: {
        Row: {
          created_at: string
          drop_weight: number
          id: string
          is_active: boolean
          machine_id: string
          points_value: number | null
          prize_image_url: string | null
          prize_name: string
          prize_name_ar: string
          prize_ref_id: string | null
          prize_type: string
          rarity_tier_id: string | null
          stock: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          drop_weight?: number
          id?: string
          is_active?: boolean
          machine_id: string
          points_value?: number | null
          prize_image_url?: string | null
          prize_name: string
          prize_name_ar: string
          prize_ref_id?: string | null
          prize_type: string
          rarity_tier_id?: string | null
          stock?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          drop_weight?: number
          id?: string
          is_active?: boolean
          machine_id?: string
          points_value?: number | null
          prize_image_url?: string | null
          prize_name?: string
          prize_name_ar?: string
          prize_ref_id?: string | null
          prize_type?: string
          rarity_tier_id?: string | null
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_machine_prizes_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "gacha_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_machine_prizes_rarity_tier_id_fkey"
            columns: ["rarity_tier_id"]
            isOneToOne: false
            referencedRelation: "gacha_rarity_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_machines: {
        Row: {
          available_from: string | null
          available_until: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          is_limited: boolean
          model_url: string | null
          multi_spin_options: Json
          name: string
          name_ar: string
          name_en: string | null
          name_ku: string | null
          theme: string
          ticket_cost: number
          updated_at: string
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_limited?: boolean
          model_url?: string | null
          multi_spin_options?: Json
          name: string
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          theme?: string
          ticket_cost?: number
          updated_at?: string
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_limited?: boolean
          model_url?: string | null
          multi_spin_options?: Json
          name?: string
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          theme?: string
          ticket_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      gacha_marketplace: {
        Row: {
          asking_price: number
          buyer_id: string | null
          created_at: string
          doll_id: string
          id: string
          inventory_item_id: string
          seller_id: string
          sold_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          asking_price: number
          buyer_id?: string | null
          created_at?: string
          doll_id: string
          id?: string
          inventory_item_id: string
          seller_id: string
          sold_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          asking_price?: number
          buyer_id?: string | null
          created_at?: string
          doll_id?: string
          id?: string
          inventory_item_id?: string
          seller_id?: string
          sold_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_marketplace_doll_id_fkey"
            columns: ["doll_id"]
            isOneToOne: false
            referencedRelation: "gacha_dolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_marketplace_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "gacha_user_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_price_history: {
        Row: {
          demand_score: number | null
          doll_id: string
          id: string
          price: number
          snapshot_at: string
          supply_count: number | null
        }
        Insert: {
          demand_score?: number | null
          doll_id: string
          id?: string
          price: number
          snapshot_at?: string
          supply_count?: number | null
        }
        Update: {
          demand_score?: number | null
          doll_id?: string
          id?: string
          price?: number
          snapshot_at?: string
          supply_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gacha_price_history_doll_id_fkey"
            columns: ["doll_id"]
            isOneToOne: false
            referencedRelation: "gacha_dolls"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_rarity_tiers: {
        Row: {
          color: string
          created_at: string
          display_order: number
          drop_weight: number
          glow_color: string
          id: string
          name: string
          name_ar: string
          name_en: string | null
          name_ku: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          display_order?: number
          drop_weight?: number
          glow_color?: string
          id?: string
          name: string
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          display_order?: number
          drop_weight?: number
          glow_color?: string
          id?: string
          name?: string
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gacha_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      gacha_spins: {
        Row: {
          created_at: string
          guaranteed_rule_id: string | null
          id: string
          is_guaranteed: boolean
          machine_id: string
          prize_id: string | null
          prize_name: string
          prize_name_ar: string
          prize_type: string
          rarity_tier_id: string | null
          tickets_spent: number
          user_id: string
        }
        Insert: {
          created_at?: string
          guaranteed_rule_id?: string | null
          id?: string
          is_guaranteed?: boolean
          machine_id: string
          prize_id?: string | null
          prize_name: string
          prize_name_ar: string
          prize_type: string
          rarity_tier_id?: string | null
          tickets_spent?: number
          user_id: string
        }
        Update: {
          created_at?: string
          guaranteed_rule_id?: string | null
          id?: string
          is_guaranteed?: boolean
          machine_id?: string
          prize_id?: string | null
          prize_name?: string
          prize_name_ar?: string
          prize_type?: string
          rarity_tier_id?: string | null
          tickets_spent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_spins_guaranteed_rule_id_fkey"
            columns: ["guaranteed_rule_id"]
            isOneToOne: false
            referencedRelation: "gacha_guaranteed_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_spins_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "gacha_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_spins_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "gacha_machine_prizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_spins_rarity_tier_id_fkey"
            columns: ["rarity_tier_id"]
            isOneToOne: false
            referencedRelation: "gacha_rarity_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_transactions: {
        Row: {
          amount: number
          counterparty_id: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          counterparty_id?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          counterparty_id?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      gacha_user_coupons: {
        Row: {
          coupon_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_used: boolean
          spin_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean
          spin_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean
          spin_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_user_coupons_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "gacha_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_user_coupons_spin_id_fkey"
            columns: ["spin_id"]
            isOneToOne: false
            referencedRelation: "gacha_spins"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_user_inventory: {
        Row: {
          acquired_from: string
          acquired_price: number | null
          created_at: string
          doll_id: string
          id: string
          is_listed: boolean
          spin_id: string | null
          user_id: string
        }
        Insert: {
          acquired_from?: string
          acquired_price?: number | null
          created_at?: string
          doll_id: string
          id?: string
          is_listed?: boolean
          spin_id?: string | null
          user_id: string
        }
        Update: {
          acquired_from?: string
          acquired_price?: number | null
          created_at?: string
          doll_id?: string
          id?: string
          is_listed?: boolean
          spin_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_user_inventory_doll_id_fkey"
            columns: ["doll_id"]
            isOneToOne: false
            referencedRelation: "gacha_dolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_user_inventory_spin_id_fkey"
            columns: ["spin_id"]
            isOneToOne: false
            referencedRelation: "gacha_spins"
            referencedColumns: ["id"]
          },
        ]
      }
      game_music_stations: {
        Row: {
          created_at: string
          display_order: number
          file_url: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          name_ku: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          file_url: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          file_url?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      game_prizes: {
        Row: {
          created_at: string
          game_name: string
          how_won_ar: string | null
          id: string
          is_delivered: boolean
          prize_image_url: string | null
          prize_name_ar: string
          prize_type: string
          product_id: string | null
          score_achieved: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          game_name: string
          how_won_ar?: string | null
          id?: string
          is_delivered?: boolean
          prize_image_url?: string | null
          prize_name_ar: string
          prize_type?: string
          product_id?: string | null
          score_achieved?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          game_name?: string
          how_won_ar?: string | null
          id?: string
          is_delivered?: boolean
          prize_image_url?: string | null
          prize_name_ar?: string
          prize_type?: string
          product_id?: string | null
          score_achieved?: number | null
          user_id?: string
        }
        Relationships: []
      }
      game_store_purchases: {
        Row: {
          created_at: string
          id: string
          points_spent: number
          reward_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_spent: number
          reward_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_spent?: number
          reward_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_store_purchases_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "game_store_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      game_store_rewards: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          max_purchases: number | null
          points_cost: number
          reward_type: string
          reward_value: number
          title_ar: string
          title_en: string | null
          title_ku: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_purchases?: number | null
          points_cost?: number
          reward_type?: string
          reward_value?: number
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_purchases?: number | null
          points_cost?: number
          reward_type?: string
          reward_value?: number
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Relationships: []
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
          description_en: string | null
          description_ku: string | null
          id: string
          manager_id: string
          skills_required: string[] | null
          status: string
          title: string
          title_ar: string
          title_en: string | null
          title_ku: string | null
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
          description_en?: string | null
          description_ku?: string | null
          id?: string
          manager_id: string
          skills_required?: string[] | null
          status?: string
          title: string
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
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
          description_en?: string | null
          description_ku?: string | null
          id?: string
          manager_id?: string
          skills_required?: string[] | null
          status?: string
          title?: string
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
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
      internal_http_secrets: {
        Row: {
          created_at: string
          purpose: string
          secret: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          purpose: string
          secret: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          purpose?: string
          secret?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          color_name: string | null
          created_at: string | null
          created_by: string | null
          id: string
          movement_type: string
          note: string | null
          option_name: string | null
          product_id: string
          quantity: number
          stock_field: string | null
        }
        Insert: {
          color_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type: string
          note?: string | null
          option_name?: string | null
          product_id: string
          quantity: number
          stock_field?: string | null
        }
        Update: {
          color_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type?: string
          note?: string | null
          option_name?: string | null
          product_id?: string
          quantity?: number
          stock_field?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          name_ar: string
          name_en: string | null
          name_ku: string | null
          template_config: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          template_config?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          template_config?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      knife_rain_high_scores: {
        Row: {
          all_time_high_score: number | null
          best_stage: number
          high_score: number
          id: string
          season: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          all_time_high_score?: number | null
          best_stage?: number
          high_score?: number
          id?: string
          season?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          all_time_high_score?: number | null
          best_stage?: number
          high_score?: number
          id?: string
          season?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knife_rain_leaderboard_prizes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          position: number
          prize_name_ar: string
          product_id: string | null
          selected_color: string | null
          selected_option_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          position: number
          prize_name_ar?: string
          product_id?: string | null
          selected_color?: string | null
          selected_option_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          prize_name_ar?: string
          product_id?: string | null
          selected_color?: string | null
          selected_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knife_rain_leaderboard_prizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knife_rain_leaderboard_prizes_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knife_rain_leaderboard_prizes_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "product_options_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      knife_rain_milestone_claims: {
        Row: {
          created_at: string
          id: string
          milestone_id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          milestone_id: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          milestone_id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knife_rain_milestone_claims_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "knife_rain_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knife_rain_milestone_claims_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "knife_rain_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      knife_rain_milestones: {
        Row: {
          claimed_count: number
          created_at: string
          id: string
          is_active: boolean
          prize_name_ar: string
          product_id: string | null
          selected_color: string | null
          selected_option_id: string | null
          stock: number
          target_score: number
        }
        Insert: {
          claimed_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          prize_name_ar?: string
          product_id?: string | null
          selected_color?: string | null
          selected_option_id?: string | null
          stock?: number
          target_score: number
        }
        Update: {
          claimed_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          prize_name_ar?: string
          product_id?: string | null
          selected_color?: string | null
          selected_option_id?: string | null
          stock?: number
          target_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "knife_rain_milestones_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knife_rain_milestones_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knife_rain_milestones_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "product_options_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      knife_rain_sessions: {
        Row: {
          ended_at: string | null
          id: string
          knives_thrown: number | null
          points_awarded: number | null
          score: number | null
          session_token: string
          stage_reached: number | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          knives_thrown?: number | null
          points_awarded?: number | null
          score?: number | null
          session_token: string
          stage_reached?: number | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          knives_thrown?: number | null
          points_awarded?: number | null
          score?: number | null
          session_token?: string
          stage_reached?: number | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      knife_rain_settings: {
        Row: {
          boss_bonus: number
          created_at: string
          entry_fee_tickets: number
          game_combo_multiplier: number
          game_enabled: boolean
          game_points_per_knife: number
          id: string
          max_daily_plays: number | null
          points_per_knife: number
          season_ends_at: string | null
          season_name: string | null
          season_starts_at: string | null
          stage_clear_bonus: number
          total_plays: number
          total_points_distributed: number
          updated_at: string
        }
        Insert: {
          boss_bonus?: number
          created_at?: string
          entry_fee_tickets?: number
          game_combo_multiplier?: number
          game_enabled?: boolean
          game_points_per_knife?: number
          id?: string
          max_daily_plays?: number | null
          points_per_knife?: number
          season_ends_at?: string | null
          season_name?: string | null
          season_starts_at?: string | null
          stage_clear_bonus?: number
          total_plays?: number
          total_points_distributed?: number
          updated_at?: string
        }
        Update: {
          boss_bonus?: number
          created_at?: string
          entry_fee_tickets?: number
          game_combo_multiplier?: number
          game_enabled?: boolean
          game_points_per_knife?: number
          id?: string
          max_daily_plays?: number | null
          points_per_knife?: number
          season_ends_at?: string | null
          season_name?: string | null
          season_starts_at?: string | null
          stage_clear_bonus?: number
          total_plays?: number
          total_points_distributed?: number
          updated_at?: string
        }
        Relationships: []
      }
      knife_rain_winners: {
        Row: {
          awarded_at: string
          id: string
          position: number | null
          prize_name_ar: string
          prize_type: string
          score: number | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          id?: string
          position?: number | null
          prize_name_ar?: string
          prize_type?: string
          score?: number | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          id?: string
          position?: number | null
          prize_name_ar?: string
          prize_type?: string
          score?: number | null
          user_id?: string
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
      level_prizes: {
        Row: {
          auto_grant: boolean
          coupon_code: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_random_product: boolean
          level_id: string
          level_number: number | null
          loyalty_card_level_id: string | null
          prize_type: string
          prize_value: number | null
          product_id: string | null
          tickets_count: number | null
          title_ar: string
          title_en: string | null
          title_ku: string | null
          updated_at: string
        }
        Insert: {
          auto_grant?: boolean
          coupon_code?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_random_product?: boolean
          level_id: string
          level_number?: number | null
          loyalty_card_level_id?: string | null
          prize_type?: string
          prize_value?: number | null
          product_id?: string | null
          tickets_count?: number | null
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Update: {
          auto_grant?: boolean
          coupon_code?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_random_product?: boolean
          level_id?: string
          level_number?: number | null
          loyalty_card_level_id?: string | null
          prize_type?: string
          prize_value?: number | null
          product_id?: string | null
          tickets_count?: number | null
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "level_prizes_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "loyalty_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      levo_card_assignments: {
        Row: {
          assigned_at: string
          card_id: string
          created_at: string
          id: string
          release_reason: string | null
          released_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          card_id: string
          created_at?: string
          id?: string
          release_reason?: string | null
          released_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          card_id?: string
          created_at?: string
          id?: string
          release_reason?: string | null
          released_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "levo_card_assignments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "levo_physical_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      levo_card_subscription_history: {
        Row: {
          action: string
          created_at: string
          credit_applied: number | null
          days_remaining: number | null
          days_used: number | null
          difference_paid: number | null
          id: string
          new_plan_id: string | null
          new_subscription_id: string | null
          previous_plan_id: string | null
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          credit_applied?: number | null
          days_remaining?: number | null
          days_used?: number | null
          difference_paid?: number | null
          id?: string
          new_plan_id?: string | null
          new_subscription_id?: string | null
          previous_plan_id?: string | null
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          credit_applied?: number | null
          days_remaining?: number | null
          days_used?: number | null
          difference_paid?: number | null
          id?: string
          new_plan_id?: string | null
          new_subscription_id?: string | null
          previous_plan_id?: string | null
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "levo_card_subscription_history_new_subscription_id_fkey"
            columns: ["new_subscription_id"]
            isOneToOne: false
            referencedRelation: "levo_card_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "levo_card_subscription_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "levo_card_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      levo_card_subscriptions: {
        Row: {
          assignment_id: string
          created_at: string
          expires_at: string
          id: string
          membership_card_id: string
          notes: string | null
          paid_amount: number
          payment_method: string | null
          source_order_id: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          expires_at: string
          id?: string
          membership_card_id: string
          notes?: string | null
          paid_amount?: number
          payment_method?: string | null
          source_order_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          membership_card_id?: string
          notes?: string | null
          paid_amount?: number
          payment_method?: string | null
          source_order_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "levo_card_subscriptions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "levo_card_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "levo_card_subscriptions_membership_card_id_fkey"
            columns: ["membership_card_id"]
            isOneToOne: false
            referencedRelation: "membership_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      levo_physical_cards: {
        Row: {
          batch_label: string | null
          card_number: string
          card_number_last4: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          batch_label?: string | null
          card_number: string
          card_number_last4: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          batch_label?: string | null
          card_number?: string
          card_number_last4?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      listing_conversations: {
        Row: {
          admin_joined: boolean | null
          buyer_id: string
          conversation_code: string | null
          created_at: string
          entry_context: Json | null
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
          entry_context?: Json | null
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
          entry_context?: Json | null
          id?: string
          listing_id?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      listing_messages: {
        Row: {
          address_data: Json | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          is_read: boolean | null
          location_data: Json | null
          message_type: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          address_data?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          location_data?: Json | null
          message_type?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          address_data?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          location_data?: Json | null
          message_type?: string | null
          reply_to_id?: string | null
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
          {
            foreignKeyName: "listing_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "listing_messages"
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
        Relationships: []
      }
      loyalty_free_shipping_usage: {
        Row: {
          card_id: string
          delivery_method_key: string
          id: string
          order_id: string | null
          saved_amount: number
          used_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          delivery_method_key: string
          id?: string
          order_id?: string | null
          saved_amount?: number
          used_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          delivery_method_key?: string
          id?: string
          order_id?: string | null
          saved_amount?: number
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_free_shipping_usage_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "user_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_free_shipping_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_levels: {
        Row: {
          benefits: Json
          bonus_points_percentage: number | null
          color: string
          created_at: string
          display_order: number
          icon: string | null
          id: string
          level_key: string
          level_number: number | null
          min_points: number
          name_ar: string
          name_en: string
          updated_at: string
          xp_required: number
        }
        Insert: {
          benefits?: Json
          bonus_points_percentage?: number | null
          color: string
          created_at?: string
          display_order: number
          icon?: string | null
          id?: string
          level_key: string
          level_number?: number | null
          min_points?: number
          name_ar: string
          name_en: string
          updated_at?: string
          xp_required?: number
        }
        Update: {
          benefits?: Json
          bonus_points_percentage?: number | null
          color?: string
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          level_key?: string
          level_number?: number | null
          min_points?: number
          name_ar?: string
          name_en?: string
          updated_at?: string
          xp_required?: number
        }
        Relationships: []
      }
      loyalty_percentage_discount_usage: {
        Row: {
          card_id: string
          discount_amount: number
          id: string
          order_id: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          used_at?: string
          user_id?: string
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
          name_en: string | null
          name_ku: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_technicians: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          name_ku: string | null
          phone: string | null
          specialization: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          phone?: string | null
          specialization?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          phone?: string | null
          specialization?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      maintenance_tickets: {
        Row: {
          assigned_engineer_id: string | null
          assigned_engineer_name: string | null
          closed_at: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          resolution_notes: string | null
          resolved_at: string | null
          status: string
          subscription_id: string | null
          title: string
          updated_at: string
          user_id: string
          user_printer_id: string | null
        }
        Insert: {
          assigned_engineer_id?: string | null
          assigned_engineer_name?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          subscription_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          user_printer_id?: string | null
        }
        Update: {
          assigned_engineer_id?: string | null
          assigned_engineer_name?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          subscription_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          user_printer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "printer_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_user_printer_id_fkey"
            columns: ["user_printer_id"]
            isOneToOne: false
            referencedRelation: "user_printers"
            referencedColumns: ["id"]
          },
        ]
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
      membership_cards: {
        Row: {
          benefits: Json | null
          bonus_points_percentage: number | null
          card_color: string | null
          card_discounts_enabled: boolean
          card_key: string
          color: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          discount_applicable_category_ids: string[] | null
          discount_percentage: number
          discount_percentage_max_amount: number | null
          display_order: number
          duration_days: number
          early_access: boolean | null
          exclusive_products: boolean | null
          frame_animation: string | null
          frame_url: string | null
          free_daily_games: number | null
          free_shipping: boolean
          free_shipping_applicable_category_ids: string[] | null
          free_shipping_max_uses: number | null
          free_shipping_methods: Json | null
          free_shipping_min_order: number | null
          free_tickets_monthly: number | null
          icon: string | null
          id: string
          investment_enabled: boolean | null
          is_active: boolean
          is_purchasable: boolean
          is_vip_plus: boolean
          monthly_free_shipping: number | null
          name_ar: string
          name_en: string | null
          name_ku: string | null
          price_points: number
          priority_packaging: boolean | null
          priority_shipping: boolean | null
          priority_support: boolean | null
          profile_effects: Json | null
          special_name_style: Json | null
          updated_at: string
          vip_support: boolean | null
          wallet_price: number | null
          wholesale_discount_enabled: boolean | null
        }
        Insert: {
          benefits?: Json | null
          bonus_points_percentage?: number | null
          card_color?: string | null
          card_discounts_enabled?: boolean
          card_key: string
          color?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          discount_applicable_category_ids?: string[] | null
          discount_percentage?: number
          discount_percentage_max_amount?: number | null
          display_order?: number
          duration_days?: number
          early_access?: boolean | null
          exclusive_products?: boolean | null
          frame_animation?: string | null
          frame_url?: string | null
          free_daily_games?: number | null
          free_shipping?: boolean
          free_shipping_applicable_category_ids?: string[] | null
          free_shipping_max_uses?: number | null
          free_shipping_methods?: Json | null
          free_shipping_min_order?: number | null
          free_tickets_monthly?: number | null
          icon?: string | null
          id?: string
          investment_enabled?: boolean | null
          is_active?: boolean
          is_purchasable?: boolean
          is_vip_plus?: boolean
          monthly_free_shipping?: number | null
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          price_points?: number
          priority_packaging?: boolean | null
          priority_shipping?: boolean | null
          priority_support?: boolean | null
          profile_effects?: Json | null
          special_name_style?: Json | null
          updated_at?: string
          vip_support?: boolean | null
          wallet_price?: number | null
          wholesale_discount_enabled?: boolean | null
        }
        Update: {
          benefits?: Json | null
          bonus_points_percentage?: number | null
          card_color?: string | null
          card_discounts_enabled?: boolean
          card_key?: string
          color?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          discount_applicable_category_ids?: string[] | null
          discount_percentage?: number
          discount_percentage_max_amount?: number | null
          display_order?: number
          duration_days?: number
          early_access?: boolean | null
          exclusive_products?: boolean | null
          frame_animation?: string | null
          frame_url?: string | null
          free_daily_games?: number | null
          free_shipping?: boolean
          free_shipping_applicable_category_ids?: string[] | null
          free_shipping_max_uses?: number | null
          free_shipping_methods?: Json | null
          free_shipping_min_order?: number | null
          free_tickets_monthly?: number | null
          icon?: string | null
          id?: string
          investment_enabled?: boolean | null
          is_active?: boolean
          is_purchasable?: boolean
          is_vip_plus?: boolean
          monthly_free_shipping?: number | null
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          price_points?: number
          priority_packaging?: boolean | null
          priority_shipping?: boolean | null
          priority_support?: boolean | null
          profile_effects?: Json | null
          special_name_style?: Json | null
          updated_at?: string
          vip_support?: boolean | null
          wallet_price?: number | null
          wholesale_discount_enabled?: boolean | null
        }
        Relationships: []
      }
      merchant_ad_bookings: {
        Row: {
          cancelled_at: string | null
          created_at: string
          expires_at: string | null
          hours_booked: number
          id: string
          merchant_id: string
          refund_amount: number | null
          slot_position: number
          started_at: string | null
          status: string
          total_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          hours_booked: number
          id?: string
          merchant_id: string
          refund_amount?: number | null
          slot_position: number
          started_at?: string | null
          status?: string
          total_cost: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          hours_booked?: number
          id?: string
          merchant_id?: string
          refund_amount?: number | null
          slot_position?: number
          started_at?: string | null
          status?: string
          total_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      merchant_ad_slots: {
        Row: {
          created_at: string
          id: string
          position: number
          price_per_hour: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          position: number
          price_per_hour?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          price_per_hour?: number
          updated_at?: string
        }
        Relationships: []
      }
      merchant_application_private: {
        Row: {
          address: string | null
          application_id: string
          birth_date: string | null
          created_at: string
          gender: string | null
          legal_full_name: string | null
          nickname: string | null
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          application_id: string
          birth_date?: string | null
          created_at?: string
          gender?: string | null
          legal_full_name?: string | null
          nickname?: string | null
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          application_id?: string
          birth_date?: string | null
          created_at?: string
          gender?: string | null
          legal_full_name?: string | null
          nickname?: string | null
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_application_private_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "merchant_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_application_private_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "merchant_applications_owner_view"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_applications: {
        Row: {
          admin_notes: string | null
          away_message: string | null
          badge_override: boolean
          badge_tier: string
          bio: string | null
          city: string | null
          created_at: string
          display_name: string | null
          fee_status: string
          fee_transaction_id: string | null
          id: string
          inquiry_template: string | null
          is_away: boolean | null
          is_verified: boolean
          phone_number: string | null
          registration_fee: number
          rejected_at: string | null
          selected_frame_id: string | null
          social_links: Json | null
          specialty: string | null
          status: string
          store_background_blur: number
          store_background_type: string
          store_background_value: string | null
          store_image_url: string | null
          store_layout: string
          store_pause_end_date: string | null
          store_pause_message: string | null
          store_paused: boolean | null
          store_slug: string | null
          updated_at: string
          user_id: string
          welcome_message: string | null
        }
        Insert: {
          admin_notes?: string | null
          away_message?: string | null
          badge_override?: boolean
          badge_tier?: string
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          fee_status?: string
          fee_transaction_id?: string | null
          id?: string
          inquiry_template?: string | null
          is_away?: boolean | null
          is_verified?: boolean
          phone_number?: string | null
          registration_fee?: number
          rejected_at?: string | null
          selected_frame_id?: string | null
          social_links?: Json | null
          specialty?: string | null
          status?: string
          store_background_blur?: number
          store_background_type?: string
          store_background_value?: string | null
          store_image_url?: string | null
          store_layout?: string
          store_pause_end_date?: string | null
          store_pause_message?: string | null
          store_paused?: boolean | null
          store_slug?: string | null
          updated_at?: string
          user_id: string
          welcome_message?: string | null
        }
        Update: {
          admin_notes?: string | null
          away_message?: string | null
          badge_override?: boolean
          badge_tier?: string
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          fee_status?: string
          fee_transaction_id?: string | null
          id?: string
          inquiry_template?: string | null
          is_away?: boolean | null
          is_verified?: boolean
          phone_number?: string | null
          registration_fee?: number
          rejected_at?: string | null
          selected_frame_id?: string | null
          social_links?: Json | null
          specialty?: string | null
          status?: string
          store_background_blur?: number
          store_background_type?: string
          store_background_value?: string | null
          store_image_url?: string | null
          store_layout?: string
          store_pause_end_date?: string | null
          store_pause_message?: string | null
          store_paused?: boolean | null
          store_slug?: string | null
          updated_at?: string
          user_id?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_applications_selected_frame_id_fkey"
            columns: ["selected_frame_id"]
            isOneToOne: false
            referencedRelation: "avatar_frames"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_badge_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      merchant_debts: {
        Row: {
          amount: number
          created_at: string
          id: string
          merchant_application_id: string
          merchant_user_id: string
          order_id: string | null
          paid_amount: number
          paid_at: string | null
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          merchant_application_id: string
          merchant_user_id: string
          order_id?: string | null
          paid_amount?: number
          paid_at?: string | null
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          merchant_application_id?: string
          merchant_user_id?: string
          order_id?: string | null
          paid_amount?: number
          paid_at?: string | null
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      merchant_giveaway_entries: {
        Row: {
          created_at: string
          giveaway_id: string
          id: string
          merchant_id: string
          merchant_name: string
          merchant_store_image: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          giveaway_id: string
          id?: string
          merchant_id: string
          merchant_name: string
          merchant_store_image?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          giveaway_id?: string
          id?: string
          merchant_id?: string
          merchant_name?: string
          merchant_store_image?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_giveaway_entries_giveaway_id_fkey"
            columns: ["giveaway_id"]
            isOneToOne: false
            referencedRelation: "merchant_giveaways"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_giveaways: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          draw_date: string | null
          end_date: string | null
          id: string
          max_participants: number | null
          prize_image_url: string | null
          prize_name_ar: string
          prize_value: number | null
          product_id: string | null
          start_date: string
          status: string
          title_ar: string
          title_en: string | null
          title_ku: string | null
          updated_at: string
          winner_merchant_id: string | null
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          draw_date?: string | null
          end_date?: string | null
          id?: string
          max_participants?: number | null
          prize_image_url?: string | null
          prize_name_ar: string
          prize_value?: number | null
          product_id?: string | null
          start_date?: string
          status?: string
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
          winner_merchant_id?: string | null
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          draw_date?: string | null
          end_date?: string | null
          id?: string
          max_participants?: number | null
          prize_image_url?: string | null
          prize_name_ar?: string
          prize_value?: number | null
          product_id?: string | null
          start_date?: string
          status?: string
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
          winner_merchant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_giveaways_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_monthly_orders: {
        Row: {
          completed_orders: number
          created_at: string
          id: string
          merchant_id: string
          updated_at: string
          year_month: string
        }
        Insert: {
          completed_orders?: number
          created_at?: string
          id?: string
          merchant_id: string
          updated_at?: string
          year_month: string
        }
        Update: {
          completed_orders?: number
          created_at?: string
          id?: string
          merchant_id?: string
          updated_at?: string
          year_month?: string
        }
        Relationships: []
      }
      merchant_printer_models: {
        Row: {
          brand: string | null
          created_at: string
          id: string
          merchant_id: string
          model_name: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          id?: string
          merchant_id: string
          model_name: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          id?: string
          merchant_id?: string
          model_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_printer_models_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_printer_models_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_applications_owner_view"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_products: {
        Row: {
          allow_partial_payment: boolean | null
          allow_wallet_payment: boolean | null
          category_ids: string[] | null
          colors: Json | null
          created_at: string
          current_queue_count: number
          description: string | null
          estimated_days: number | null
          id: string
          image_urls: string[] | null
          is_active: boolean
          is_featured: boolean
          is_preorder: boolean | null
          material_type: string | null
          max_queue_slots: number | null
          merchant_id: string
          options: Json | null
          original_price_iqd: number | null
          preorder_available_date: string | null
          preorder_deposit_percent: number | null
          preorder_end_date: string | null
          preorder_note: string | null
          preorder_queue_current: number | null
          preorder_queue_total: number | null
          price_iqd: number | null
          primary_image_index: number | null
          sale_type: string
          stock_quantity: number | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          allow_partial_payment?: boolean | null
          allow_wallet_payment?: boolean | null
          category_ids?: string[] | null
          colors?: Json | null
          created_at?: string
          current_queue_count?: number
          description?: string | null
          estimated_days?: number | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean
          is_featured?: boolean
          is_preorder?: boolean | null
          material_type?: string | null
          max_queue_slots?: number | null
          merchant_id: string
          options?: Json | null
          original_price_iqd?: number | null
          preorder_available_date?: string | null
          preorder_deposit_percent?: number | null
          preorder_end_date?: string | null
          preorder_note?: string | null
          preorder_queue_current?: number | null
          preorder_queue_total?: number | null
          price_iqd?: number | null
          primary_image_index?: number | null
          sale_type?: string
          stock_quantity?: number | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          allow_partial_payment?: boolean | null
          allow_wallet_payment?: boolean | null
          category_ids?: string[] | null
          colors?: Json | null
          created_at?: string
          current_queue_count?: number
          description?: string | null
          estimated_days?: number | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean
          is_featured?: boolean
          is_preorder?: boolean | null
          material_type?: string | null
          max_queue_slots?: number | null
          merchant_id?: string
          options?: Json | null
          original_price_iqd?: number | null
          preorder_available_date?: string | null
          preorder_deposit_percent?: number | null
          preorder_end_date?: string | null
          preorder_note?: string | null
          preorder_queue_current?: number | null
          preorder_queue_total?: number | null
          price_iqd?: number | null
          primary_image_index?: number | null
          sale_type?: string
          stock_quantity?: number | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_applications_owner_view"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_public_profiles: {
        Row: {
          accepted_payment_methods: Json | null
          badge_tier: string
          bio: string | null
          city: string | null
          created_at: string
          debt_suspended: boolean
          debt_suspended_at: string | null
          delivery_price_iqd: number | null
          delivery_rules: Json | null
          display_name: string | null
          id: string
          is_verified: boolean
          selected_frame_id: string | null
          social_links: Json | null
          specialty: string | null
          store_background_blur: number
          store_background_type: string
          store_background_value: string | null
          store_image_url: string | null
          store_layout: string
          store_slug: string | null
          total_debt: number
          updated_at: string
        }
        Insert: {
          accepted_payment_methods?: Json | null
          badge_tier?: string
          bio?: string | null
          city?: string | null
          created_at?: string
          debt_suspended?: boolean
          debt_suspended_at?: string | null
          delivery_price_iqd?: number | null
          delivery_rules?: Json | null
          display_name?: string | null
          id: string
          is_verified?: boolean
          selected_frame_id?: string | null
          social_links?: Json | null
          specialty?: string | null
          store_background_blur?: number
          store_background_type?: string
          store_background_value?: string | null
          store_image_url?: string | null
          store_layout?: string
          store_slug?: string | null
          total_debt?: number
          updated_at?: string
        }
        Update: {
          accepted_payment_methods?: Json | null
          badge_tier?: string
          bio?: string | null
          city?: string | null
          created_at?: string
          debt_suspended?: boolean
          debt_suspended_at?: string | null
          delivery_price_iqd?: number | null
          delivery_rules?: Json | null
          display_name?: string | null
          id?: string
          is_verified?: boolean
          selected_frame_id?: string | null
          social_links?: Json | null
          specialty?: string | null
          store_background_blur?: number
          store_background_type?: string
          store_background_value?: string | null
          store_image_url?: string | null
          store_layout?: string
          store_slug?: string | null
          total_debt?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_public_profiles_selected_frame_id_fkey"
            columns: ["selected_frame_id"]
            isOneToOne: false
            referencedRelation: "avatar_frames"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_rating_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_admin_reply: boolean | null
          is_hidden: boolean | null
          parent_id: string | null
          rating_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_admin_reply?: boolean | null
          is_hidden?: boolean | null
          parent_id?: string | null
          rating_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_admin_reply?: boolean | null
          is_hidden?: boolean | null
          parent_id?: string | null
          rating_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_rating_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "merchant_rating_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_rating_comments_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: false
            referencedRelation: "merchant_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_rating_replies: {
        Row: {
          created_at: string
          id: string
          merchant_id: string
          rating_id: string
          reply_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          merchant_id: string
          rating_id: string
          reply_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          merchant_id?: string
          rating_id?: string
          reply_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_rating_replies_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: true
            referencedRelation: "merchant_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_ratings: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          image_urls: string[] | null
          is_auto_rating: boolean
          is_hidden: boolean | null
          is_published: boolean | null
          merchant_id: string
          points_awarded: number | null
          purchase_count: number
          rating: number
          request_id: string
          review_text: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          image_urls?: string[] | null
          is_auto_rating?: boolean
          is_hidden?: boolean | null
          is_published?: boolean | null
          merchant_id: string
          points_awarded?: number | null
          purchase_count?: number
          rating: number
          request_id: string
          review_text?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          image_urls?: string[] | null
          is_auto_rating?: boolean
          is_hidden?: boolean | null
          is_published?: boolean | null
          merchant_id?: string
          points_awarded?: number | null
          purchase_count?: number
          rating?: number
          request_id?: string
          review_text?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_ratings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_ratings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_applications_owner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_ratings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "print_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_reels: {
        Row: {
          approved_at: string | null
          business_multiplier: number | null
          caption: string | null
          category_id: string | null
          clicks_count: number
          created_at: string
          duration_seconds: number | null
          first_1000_impressions_at: string | null
          full_watches_count: number
          id: string
          is_sponsored: boolean | null
          likes_count: number
          merchant_id: string | null
          product_id: string | null
          quality_score: number | null
          ranking_score: number | null
          rejection_reason: string | null
          saves_count: number
          site_product_id: string | null
          status: string
          thumbnail_url: string | null
          updated_at: string
          video_url: string
          views_count: number
        }
        Insert: {
          approved_at?: string | null
          business_multiplier?: number | null
          caption?: string | null
          category_id?: string | null
          clicks_count?: number
          created_at?: string
          duration_seconds?: number | null
          first_1000_impressions_at?: string | null
          full_watches_count?: number
          id?: string
          is_sponsored?: boolean | null
          likes_count?: number
          merchant_id?: string | null
          product_id?: string | null
          quality_score?: number | null
          ranking_score?: number | null
          rejection_reason?: string | null
          saves_count?: number
          site_product_id?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          video_url: string
          views_count?: number
        }
        Update: {
          approved_at?: string | null
          business_multiplier?: number | null
          caption?: string | null
          category_id?: string | null
          clicks_count?: number
          created_at?: string
          duration_seconds?: number | null
          first_1000_impressions_at?: string | null
          full_watches_count?: number
          id?: string
          is_sponsored?: boolean | null
          likes_count?: number
          merchant_id?: string | null
          product_id?: string | null
          quality_score?: number | null
          ranking_score?: number | null
          rejection_reason?: string | null
          saves_count?: number
          site_product_id?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "merchant_reels_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "community_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_reels_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_reels_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_applications_owner_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_reels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_reels_site_product_id_fkey"
            columns: ["site_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_store_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          merchant_id: string
          name_ar: string
          name_en: string | null
          name_ku: string | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          merchant_id: string
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          merchant_id?: string
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_store_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "merchant_store_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_store_discounts: {
        Row: {
          created_at: string
          current_uses: number | null
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          discount_type: string
          discount_value: number | null
          gift_description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          max_uses: number | null
          merchant_id: string
          merchant_store_name: string | null
          min_purchase_amount: number | null
          title_ar: string
          title_en: string | null
          title_ku: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          current_uses?: number | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          discount_type?: string
          discount_value?: number | null
          gift_description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_uses?: number | null
          merchant_id: string
          merchant_store_name?: string | null
          min_purchase_amount?: number | null
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          current_uses?: number | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          discount_type?: string
          discount_value?: number | null
          gift_description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_uses?: number | null
          merchant_id?: string
          merchant_store_name?: string | null
          min_purchase_amount?: number | null
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      merchant_stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          media_type: string
          media_url: string
          merchant_id: string
          product_id: string | null
          views_count: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          media_type?: string
          media_url: string
          merchant_id: string
          product_id?: string | null
          views_count?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          media_type?: string
          media_url?: string
          merchant_id?: string
          product_id?: string | null
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "merchant_stories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_story_likes: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "merchant_stories"
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
      mystery_case_rewards: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          display_chance: string | null
          display_only: boolean
          display_order: number | null
          drop_chance: number
          id: string
          image_url: string | null
          is_active: boolean
          name_ar: string
          name_en: string | null
          name_ku: string | null
          product_id: string | null
          product_option_id: string | null
          rarity: string
          reward_type: string
          selected_color: string | null
          ticket_reward_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_chance?: string | null
          display_only?: boolean
          display_order?: number | null
          drop_chance?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          product_id?: string | null
          product_option_id?: string | null
          rarity?: string
          reward_type?: string
          selected_color?: string | null
          ticket_reward_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_chance?: string | null
          display_only?: boolean
          display_order?: number | null
          drop_chance?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          product_id?: string | null
          product_option_id?: string | null
          rarity?: string
          reward_type?: string
          selected_color?: string | null
          ticket_reward_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mystery_case_rewards_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mystery_case_rewards_product_option_id_fkey"
            columns: ["product_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mystery_case_rewards_product_option_id_fkey"
            columns: ["product_option_id"]
            isOneToOne: false
            referencedRelation: "product_options_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      mystery_case_settings: {
        Row: {
          animation_duration_ms: number
          created_at: string
          daily_free_spin: boolean
          game_enabled: boolean
          id: string
          pixel_theme: boolean
          reel_speed: number
          spin_cooldown_seconds: number
          spin_sound_enabled: boolean
          tickets_per_spin: number
          updated_at: string
        }
        Insert: {
          animation_duration_ms?: number
          created_at?: string
          daily_free_spin?: boolean
          game_enabled?: boolean
          id?: string
          pixel_theme?: boolean
          reel_speed?: number
          spin_cooldown_seconds?: number
          spin_sound_enabled?: boolean
          tickets_per_spin?: number
          updated_at?: string
        }
        Update: {
          animation_duration_ms?: number
          created_at?: string
          daily_free_spin?: boolean
          game_enabled?: boolean
          id?: string
          pixel_theme?: boolean
          reel_speed?: number
          spin_cooldown_seconds?: number
          spin_sound_enabled?: boolean
          tickets_per_spin?: number
          updated_at?: string
        }
        Relationships: []
      }
      mystery_case_spins: {
        Row: {
          claimed_at: string | null
          created_at: string
          id: string
          is_claimed: boolean
          reward_id: string | null
          reward_snapshot: Json
          tickets_spent: number
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          is_claimed?: boolean
          reward_id?: string | null
          reward_snapshot?: Json
          tickets_spent?: number
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          is_claimed?: boolean
          reward_id?: string | null
          reward_snapshot?: Json
          tickets_spent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mystery_case_spins_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "mystery_case_rewards"
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
          bundle_id: string | null
          color_image_url: string | null
          cost_price: number | null
          created_at: string
          custom_request_id: string | null
          customer_notes: string | null
          id: string
          is_gift: boolean
          order_id: string
          product_id: string | null
          product_name: string
          product_name_ar: string
          product_option_id: string | null
          quantity: number
          rf_offer_id: string | null
          selected_color: string | null
          selected_option: string | null
          serial_number: string | null
          shipping_option_name_ar: string | null
          shipping_price_adjustment: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          bundle_id?: string | null
          color_image_url?: string | null
          cost_price?: number | null
          created_at?: string
          custom_request_id?: string | null
          customer_notes?: string | null
          id?: string
          is_gift?: boolean
          order_id: string
          product_id?: string | null
          product_name: string
          product_name_ar: string
          product_option_id?: string | null
          quantity?: number
          rf_offer_id?: string | null
          selected_color?: string | null
          selected_option?: string | null
          serial_number?: string | null
          shipping_option_name_ar?: string | null
          shipping_price_adjustment?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          bundle_id?: string | null
          color_image_url?: string | null
          cost_price?: number | null
          created_at?: string
          custom_request_id?: string | null
          customer_notes?: string | null
          id?: string
          is_gift?: boolean
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_name_ar?: string
          product_option_id?: string | null
          quantity?: number
          rf_offer_id?: string | null
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
            foreignKeyName: "order_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "product_bundles"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "order_items_product_option_id_fkey"
            columns: ["product_option_id"]
            isOneToOne: false
            referencedRelation: "product_options_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_option_id_fkey_product_options"
            columns: ["product_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_option_id_fkey_product_options"
            columns: ["product_option_id"]
            isOneToOne: false
            referencedRelation: "product_options_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_rf_offer_id_fkey"
            columns: ["rf_offer_id"]
            isOneToOne: false
            referencedRelation: "random_filament_offers"
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
          auto_donation_amount: number
          cancelled_at: string | null
          card_discount_amount: number | null
          card_discount_level_name: string | null
          cod_fee: number
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_paid_amount: number | null
          customs_declaration_number: string | null
          delivered_at: string | null
          delivery_method: string | null
          discount_amount: number | null
          estimated_delivery_date: string | null
          extra_donation_amount: number
          financial_notes: string | null
          governorate: string
          id: string
          internal_notes: string | null
          on_the_way_at: string | null
          order_number: string
          order_type: string | null
          package_dimensions: string | null
          paid_amount: number | null
          payment_method: string | null
          payment_status: string | null
          phone_number: string
          priority: string | null
          processing_at: string | null
          profit_amount: number | null
          purchased_at: string | null
          referral_coupon_id: string | null
          referral_owner_earnings_iqd: number
          remaining_amount: number | null
          serial_number_image_url: string | null
          shipped_at: string | null
          shipping_address: string
          shipping_duration_days: number | null
          shipping_notes: string | null
          shipping_route_type: string | null
          shipping_route_waypoints: Json | null
          status: string
          stock_deducted: boolean | null
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
          auto_donation_amount?: number
          cancelled_at?: string | null
          card_discount_amount?: number | null
          card_discount_level_name?: string | null
          cod_fee?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_paid_amount?: number | null
          customs_declaration_number?: string | null
          delivered_at?: string | null
          delivery_method?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          extra_donation_amount?: number
          financial_notes?: string | null
          governorate: string
          id?: string
          internal_notes?: string | null
          on_the_way_at?: string | null
          order_number: string
          order_type?: string | null
          package_dimensions?: string | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          phone_number: string
          priority?: string | null
          processing_at?: string | null
          profit_amount?: number | null
          purchased_at?: string | null
          referral_coupon_id?: string | null
          referral_owner_earnings_iqd?: number
          remaining_amount?: number | null
          serial_number_image_url?: string | null
          shipped_at?: string | null
          shipping_address: string
          shipping_duration_days?: number | null
          shipping_notes?: string | null
          shipping_route_type?: string | null
          shipping_route_waypoints?: Json | null
          status?: string
          stock_deducted?: boolean | null
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
          auto_donation_amount?: number
          cancelled_at?: string | null
          card_discount_amount?: number | null
          card_discount_level_name?: string | null
          cod_fee?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_paid_amount?: number | null
          customs_declaration_number?: string | null
          delivered_at?: string | null
          delivery_method?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          extra_donation_amount?: number
          financial_notes?: string | null
          governorate?: string
          id?: string
          internal_notes?: string | null
          on_the_way_at?: string | null
          order_number?: string
          order_type?: string | null
          package_dimensions?: string | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          phone_number?: string
          priority?: string | null
          processing_at?: string | null
          profit_amount?: number | null
          purchased_at?: string | null
          referral_coupon_id?: string | null
          referral_owner_earnings_iqd?: number
          remaining_amount?: number | null
          serial_number_image_url?: string | null
          shipped_at?: string | null
          shipping_address?: string
          shipping_duration_days?: number | null
          shipping_notes?: string | null
          shipping_route_type?: string | null
          shipping_route_waypoints?: Json | null
          status?: string
          stock_deducted?: boolean | null
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
          {
            foreignKeyName: "orders_user_id_fkey_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_print_reputation"
            referencedColumns: ["user_id"]
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
      pending_task_approvals: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          instagram_username: string | null
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          task_key: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          instagram_username?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          task_key: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          instagram_username?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          task_key?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_discount_usage: {
        Row: {
          category_id: string | null
          created_at: string
          discount_amount: number
          id: string
          order_id: string | null
          plan_id: string
          product_id: string | null
          subscription_id: string
          used_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          plan_id: string
          product_id?: string | null
          subscription_id: string
          used_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          plan_id?: string
          product_id?: string | null
          subscription_id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_discount_usage_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_discount_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_discount_usage_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "protection_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_discount_usage_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_discount_usage_subscription_id_fkey"
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
          description_en: string | null
          description_ku: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          max_per_user: number | null
          points_cost: number
          product_type: string
          stock_quantity: number | null
          title_ar: string
          title_en: string | null
          title_ku: string | null
          updated_at: string
          valid_days: number | null
          value_amount: number
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_per_user?: number | null
          points_cost: number
          product_type?: string
          stock_quantity?: number | null
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
          valid_days?: number | null
          value_amount?: number
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_per_user?: number | null
          points_cost?: number
          product_type?: string
          stock_quantity?: number | null
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
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
      price_match_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          found_price: number
          id: string
          image_url: string | null
          notes: string | null
          product_id: string
          source_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          found_price: number
          id?: string
          image_url?: string | null
          notes?: string | null
          product_id: string
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          found_price?: number
          id?: string
          image_url?: string | null
          notes?: string | null
          product_id?: string
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_match_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_protection_claims: {
        Row: {
          admin_id: string | null
          admin_notes: string | null
          conversation_id: string | null
          created_at: string
          id: string
          new_price: number
          old_price: number
          order_id: string
          order_item_id: string
          order_number: string | null
          price_difference: number
          processed_at: string | null
          product_id: string
          product_image: string | null
          product_name_ar: string | null
          purchase_date: string
          quantity: number
          refunded_amount: number | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["price_protection_status"]
          total_refund: number
          updated_at: string
          user_id: string
          user_requested_at: string | null
        }
        Insert: {
          admin_id?: string | null
          admin_notes?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          new_price: number
          old_price: number
          order_id: string
          order_item_id: string
          order_number?: string | null
          price_difference: number
          processed_at?: string | null
          product_id: string
          product_image?: string | null
          product_name_ar?: string | null
          purchase_date: string
          quantity?: number
          refunded_amount?: number | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["price_protection_status"]
          total_refund: number
          updated_at?: string
          user_id: string
          user_requested_at?: string | null
        }
        Update: {
          admin_id?: string | null
          admin_notes?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          new_price?: number
          old_price?: number
          order_id?: string
          order_item_id?: string
          order_number?: string | null
          price_difference?: number
          processed_at?: string | null
          product_id?: string
          product_image?: string | null
          product_name_ar?: string | null
          purchase_date?: string
          quantity?: number
          refunded_amount?: number | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["price_protection_status"]
          total_refund?: number
          updated_at?: string
          user_id?: string
          user_requested_at?: string | null
        }
        Relationships: []
      }
      print_machine_profiles: {
        Row: {
          created_at: string
          current_queue_count: number
          hourly_cost_iqd: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          nozzle_flow_rate_cm3_min: number
          process_type: string
          travel_overhead_per_layer_sec: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_queue_count?: number
          hourly_cost_iqd?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          nozzle_flow_rate_cm3_min?: number
          process_type?: string
          travel_overhead_per_layer_sec?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_queue_count?: number
          hourly_cost_iqd?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          nozzle_flow_rate_cm3_min?: number
          process_type?: string
          travel_overhead_per_layer_sec?: number
          updated_at?: string
        }
        Relationships: []
      }
      print_materials: {
        Row: {
          code: string
          cost_per_kg_iqd: number
          created_at: string
          default_infill_pct: number
          default_layer_height_mm: number
          default_nozzle_mm: number
          default_print_speed_mm_s: number
          density_g_cm3: number
          display_order: number
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          name_ku: string | null
          process_type: string
          shrinkage_pct: number
          updated_at: string
        }
        Insert: {
          code: string
          cost_per_kg_iqd: number
          created_at?: string
          default_infill_pct?: number
          default_layer_height_mm?: number
          default_nozzle_mm?: number
          default_print_speed_mm_s?: number
          density_g_cm3: number
          display_order?: number
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          name_ku?: string | null
          process_type?: string
          shrinkage_pct?: number
          updated_at?: string
        }
        Update: {
          code?: string
          cost_per_kg_iqd?: number
          created_at?: string
          default_infill_pct?: number
          default_layer_height_mm?: number
          default_nozzle_mm?: number
          default_print_speed_mm_s?: number
          density_g_cm3?: number
          display_order?: number
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          name_ku?: string | null
          process_type?: string
          shrinkage_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      print_offers: {
        Row: {
          accepted_at: string | null
          completed_at: string | null
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          duration_days: number
          edit_count: number
          grams: number | null
          id: string
          material_subtypes: string[] | null
          material_type: string | null
          notes: string | null
          offer_sent_at: string | null
          price_iqd: number
          request_id: string
          status: Database["public"]["Enums"]["print_offer_status"]
          trader_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          duration_days: number
          edit_count?: number
          grams?: number | null
          id?: string
          material_subtypes?: string[] | null
          material_type?: string | null
          notes?: string | null
          offer_sent_at?: string | null
          price_iqd: number
          request_id: string
          status?: Database["public"]["Enums"]["print_offer_status"]
          trader_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          duration_days?: number
          edit_count?: number
          grams?: number | null
          id?: string
          material_subtypes?: string[] | null
          material_type?: string | null
          notes?: string | null
          offer_sent_at?: string | null
          price_iqd?: number
          request_id?: string
          status?: Database["public"]["Enums"]["print_offer_status"]
          trader_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "community_print_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "community_print_requests_public"
            referencedColumns: ["id"]
          },
        ]
      }
      print_quotations: {
        Row: {
          breakdown: Json
          created_at: string
          currency: string
          difficulty_score: number | null
          final_iqd: number
          id: string
          input_payload: Json
          material_code: string | null
          pdf_url: string | null
          print_request_id: string | null
          process_type: string
          qty: number
          quote_number: string
          rush_tier: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          currency?: string
          difficulty_score?: number | null
          final_iqd?: number
          id?: string
          input_payload?: Json
          material_code?: string | null
          pdf_url?: string | null
          print_request_id?: string | null
          process_type?: string
          qty?: number
          quote_number?: string
          rush_tier?: string
          source: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          breakdown?: Json
          created_at?: string
          currency?: string
          difficulty_score?: number | null
          final_iqd?: number
          id?: string
          input_payload?: Json
          material_code?: string | null
          pdf_url?: string | null
          print_request_id?: string | null
          process_type?: string
          qty?: number
          quote_number?: string
          rush_tier?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      print_quote_cache: {
        Row: {
          analysis_payload: Json | null
          confidence_level: string | null
          created_at: string
          expires_at: string
          extraction_engine: string | null
          file_hash: string | null
          id: string
          material_code: string | null
          payload: Json
          platform: string | null
          source: string
          url: string
        }
        Insert: {
          analysis_payload?: Json | null
          confidence_level?: string | null
          created_at?: string
          expires_at?: string
          extraction_engine?: string | null
          file_hash?: string | null
          id?: string
          material_code?: string | null
          payload: Json
          platform?: string | null
          source?: string
          url: string
        }
        Update: {
          analysis_payload?: Json | null
          confidence_level?: string | null
          created_at?: string
          expires_at?: string
          extraction_engine?: string | null
          file_hash?: string | null
          id?: string
          material_code?: string | null
          payload?: Json
          platform?: string | null
          source?: string
          url?: string
        }
        Relationships: []
      }
      print_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          quality_stars: number | null
          ratee_id: string
          rater_id: string
          rater_role: Database["public"]["Enums"]["print_rating_role"]
          request_id: string
          speed_stars: number | null
          stars: number
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          quality_stars?: number | null
          ratee_id: string
          rater_id: string
          rater_role: Database["public"]["Enums"]["print_rating_role"]
          request_id: string
          speed_stars?: number | null
          stars: number
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          quality_stars?: number | null
          ratee_id?: string
          rater_id?: string
          rater_role?: Database["public"]["Enums"]["print_rating_role"]
          request_id?: string
          speed_stars?: number | null
          stars?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_ratings_ratee_id_fkey"
            columns: ["ratee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_ratings_ratee_id_fkey"
            columns: ["ratee_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_ratings_ratee_id_fkey"
            columns: ["ratee_id"]
            isOneToOne: false
            referencedRelation: "user_print_reputation"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "print_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "user_print_reputation"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "print_ratings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "print_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      print_request_attachments: {
        Row: {
          bucket_id: string
          created_at: string
          file_name: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          request_id: string
          storage_path: string
          uploader_id: string
        }
        Insert: {
          bucket_id?: string
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          request_id: string
          storage_path: string
          uploader_id: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          request_id?: string
          storage_path?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "print_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      print_requests: {
        Row: {
          accepted_offer_id: string | null
          category_ids: string[] | null
          colors_spec: string | null
          completed_at: string | null
          created_at: string
          customer_confirmed_at: string | null
          delivered_at: string | null
          description: string | null
          id: string
          in_progress_at: string | null
          notes: string | null
          reference_links: string[]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          size_spec: string | null
          status: Database["public"]["Enums"]["print_request_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_offer_id?: string | null
          category_ids?: string[] | null
          colors_spec?: string | null
          completed_at?: string | null
          created_at?: string
          customer_confirmed_at?: string | null
          delivered_at?: string | null
          description?: string | null
          id?: string
          in_progress_at?: string | null
          notes?: string | null
          reference_links?: string[]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_spec?: string | null
          status?: Database["public"]["Enums"]["print_request_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_offer_id?: string | null
          category_ids?: string[] | null
          colors_spec?: string | null
          completed_at?: string | null
          created_at?: string
          customer_confirmed_at?: string | null
          delivered_at?: string | null
          description?: string | null
          id?: string
          in_progress_at?: string | null
          notes?: string | null
          reference_links?: string[]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_spec?: string | null
          status?: Database["public"]["Enums"]["print_request_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_requests_accepted_offer_id_fkey"
            columns: ["accepted_offer_id"]
            isOneToOne: false
            referencedRelation: "print_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      print_url_analytics: {
        Row: {
          cache_hit: boolean
          confidence_level: string | null
          converted_to_request: boolean
          created_at: string
          duration_ms: number | null
          engine_used: string | null
          id: string
          platform: string | null
          source_url: string
          url_hash: string | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          confidence_level?: string | null
          converted_to_request?: boolean
          created_at?: string
          duration_ms?: number | null
          engine_used?: string | null
          id?: string
          platform?: string | null
          source_url: string
          url_hash?: string | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          confidence_level?: string | null
          converted_to_request?: boolean
          created_at?: string
          duration_ms?: number | null
          engine_used?: string | null
          id?: string
          platform?: string | null
          source_url?: string
          url_hash?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      printer_advisor_budget_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_budget_iqd: number
          message_ar: string | null
          min_budget_iqd: number
          priority: number
          recommended_product_id: string | null
          updated_at: string
          upgrade_suggestion_product_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_budget_iqd: number
          message_ar?: string | null
          min_budget_iqd: number
          priority?: number
          recommended_product_id?: string | null
          updated_at?: string
          upgrade_suggestion_product_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_budget_iqd?: number
          message_ar?: string | null
          min_budget_iqd?: number
          priority?: number
          recommended_product_id?: string | null
          updated_at?: string
          upgrade_suggestion_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printer_advisor_budget_rules_recommended_product_id_fkey"
            columns: ["recommended_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_advisor_budget_rules_upgrade_suggestion_product_id_fkey"
            columns: ["upgrade_suggestion_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      product_batches: {
        Row: {
          batch_cost: number
          batch_quantity: number
          bundle_id: string | null
          created_at: string
          id: string
          notes: string | null
          product_id: string | null
          product_name_ar: string
          status: string
          updated_at: string
        }
        Insert: {
          batch_cost?: number
          batch_quantity?: number
          bundle_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name_ar: string
          status?: string
          updated_at?: string
        }
        Update: {
          batch_cost?: number
          batch_quantity?: number
          bundle_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name_ar?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "product_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_bookings: {
        Row: {
          booking_type: string
          created_at: string
          deposit_amount: number | null
          deposit_paid: boolean | null
          id: string
          merchant_id: string
          notes: string | null
          product_id: string
          queue_position: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_type?: string
          created_at?: string
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          id?: string
          merchant_id: string
          notes?: string | null
          product_id: string
          queue_position?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_type?: string
          created_at?: string
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          id?: string
          merchant_id?: string
          notes?: string | null
          product_id?: string
          queue_position?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_bookings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_bundles: {
        Row: {
          bundle_price: number
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          display_order: number
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean
          offer_ends_at: string | null
          original_price: number
          sale_type: string
          title_ar: string
          title_en: string | null
          title_ku: string | null
          updated_at: string
        }
        Insert: {
          bundle_price?: number
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean
          offer_ends_at?: string | null
          original_price?: number
          sale_type?: string
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Update: {
          bundle_price?: number
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean
          offer_ends_at?: string | null
          original_price?: number
          sale_type?: string
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_card_discounts: {
        Row: {
          card_id: string
          created_at: string
          discount_percentage: number
          id: string
          is_active: boolean
          product_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          discount_percentage?: number
          id?: string
          is_active?: boolean
          product_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          discount_percentage?: number
          id?: string
          is_active?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_card_discounts_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "membership_cards"
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
      product_color_qa_flags: {
        Row: {
          color_name: string
          created_at: string
          flagged_by: string | null
          id: string
          product_id: string
          reason: string | null
          resolved: boolean
          updated_at: string
        }
        Insert: {
          color_name: string
          created_at?: string
          flagged_by?: string | null
          id?: string
          product_id: string
          reason?: string | null
          resolved?: boolean
          updated_at?: string
        }
        Update: {
          color_name?: string
          created_at?: string
          flagged_by?: string | null
          id?: string
          product_id?: string
          reason?: string | null
          resolved?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_color_qa_flags_product_id_fkey"
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
          {
            foreignKeyName: "product_offer_purchases_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "product_offers_public"
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
          description_en: string | null
          description_ku: string | null
          gift_tickets: number
          id: string
          image_url: string | null
          images: string[] | null
          options: Json | null
          points_reward: number | null
          price: number
          show_in_cart: boolean
          status: string
          stock_quantity: number | null
          title: string
          title_ar: string
          title_en: string | null
          title_ku: string | null
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
          description_en?: string | null
          description_ku?: string | null
          gift_tickets?: number
          id?: string
          image_url?: string | null
          images?: string[] | null
          options?: Json | null
          points_reward?: number | null
          price?: number
          show_in_cart?: boolean
          status?: string
          stock_quantity?: number | null
          title: string
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
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
          description_en?: string | null
          description_ku?: string | null
          gift_tickets?: number
          id?: string
          image_url?: string | null
          images?: string[] | null
          options?: Json | null
          points_reward?: number | null
          price?: number
          show_in_cart?: boolean
          status?: string
          stock_quantity?: number | null
          title?: string
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          total_sold?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      product_options: {
        Row: {
          available_for_direct_sale: boolean | null
          available_for_pre_order: boolean | null
          cost_iqd: number | null
          cost_usd: number | null
          created_at: string
          id: string
          image_url: string | null
          in_stock: boolean | null
          name: string
          name_ar: string
          name_en: string | null
          name_ku: string | null
          price_adjustment: number | null
          product_id: string
          stock_quantity: number | null
          taobao_available: boolean | null
          taobao_last_sync_at: string | null
          taobao_sku_id: string | null
        }
        Insert: {
          available_for_direct_sale?: boolean | null
          available_for_pre_order?: boolean | null
          cost_iqd?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          name: string
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          price_adjustment?: number | null
          product_id: string
          stock_quantity?: number | null
          taobao_available?: boolean | null
          taobao_last_sync_at?: string | null
          taobao_sku_id?: string | null
        }
        Update: {
          available_for_direct_sale?: boolean | null
          available_for_pre_order?: boolean | null
          cost_iqd?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          name?: string
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          price_adjustment?: number | null
          product_id?: string
          stock_quantity?: number | null
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
          advisor_notes: string | null
          advisor_priority_boost: number
          advisor_recommended: boolean
          ai_content: Json | null
          air_price: number | null
          availability_type: string
          brand: string | null
          card_discounts: Json | null
          category_id: string | null
          cod_enabled: boolean
          cod_fee_type: string
          cod_fee_value: number
          colors: Json | null
          commission_air_iqd: number | null
          commission_direct_iqd: number | null
          commission_iqd: number | null
          commission_land_iqd: number
          commission_sea_iqd: number | null
          cost_price: number | null
          created_at: string | null
          created_by_assistant: string | null
          currency: string | null
          description: string | null
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          direct_sale_price: number | null
          direct_stock: number | null
          display_order: number
          featured: boolean | null
          features: Json | null
          has_in_stock: boolean | null
          has_pre_order: boolean | null
          height_cm: number | null
          id: string
          image_url: string | null
          images: string[] | null
          in_stock: boolean | null
          is_pricing_updated: boolean | null
          land_price: number | null
          last_price_update: string | null
          length_cm: number | null
          link_direct_commission_to_cod: boolean
          name: string
          name_ar: string
          name_en: string | null
          name_ku: string | null
          original_price: number | null
          original_price_usd: number | null
          other_costs_iqd: number | null
          pending_admin_review: boolean
          personal_delivery_cost: number
          points_reward: number | null
          pre_order_fast_shipping_price: number | null
          pre_order_free_shipping_price: number | null
          pre_order_shipping_options: Json | null
          pre_order_stock: number | null
          price: number
          price_usd: number | null
          referral_earnings_iqd: number
          round_up_price: boolean | null
          sea_price: number | null
          searchable_attributes: string[] | null
          shipping_cost_iqd: number | null
          shipping_type: string | null
          short_summary: Json | null
          slug: string
          sold_count: number
          taobao_availability_cache: Json | null
          taobao_last_sync_at: string | null
          taobao_sync_status: string | null
          taobao_url: string | null
          taobao_variant_mapping: Json | null
          ticket_reward: number | null
          updated_at: string | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          advisor_notes?: string | null
          advisor_priority_boost?: number
          advisor_recommended?: boolean
          ai_content?: Json | null
          air_price?: number | null
          availability_type?: string
          brand?: string | null
          card_discounts?: Json | null
          category_id?: string | null
          cod_enabled?: boolean
          cod_fee_type?: string
          cod_fee_value?: number
          colors?: Json | null
          commission_air_iqd?: number | null
          commission_direct_iqd?: number | null
          commission_iqd?: number | null
          commission_land_iqd?: number
          commission_sea_iqd?: number | null
          cost_price?: number | null
          created_at?: string | null
          created_by_assistant?: string | null
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          direct_sale_price?: number | null
          direct_stock?: number | null
          display_order?: number
          featured?: boolean | null
          features?: Json | null
          has_in_stock?: boolean | null
          has_pre_order?: boolean | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          in_stock?: boolean | null
          is_pricing_updated?: boolean | null
          land_price?: number | null
          last_price_update?: string | null
          length_cm?: number | null
          link_direct_commission_to_cod?: boolean
          name: string
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          original_price?: number | null
          original_price_usd?: number | null
          other_costs_iqd?: number | null
          pending_admin_review?: boolean
          personal_delivery_cost?: number
          points_reward?: number | null
          pre_order_fast_shipping_price?: number | null
          pre_order_free_shipping_price?: number | null
          pre_order_shipping_options?: Json | null
          pre_order_stock?: number | null
          price: number
          price_usd?: number | null
          referral_earnings_iqd?: number
          round_up_price?: boolean | null
          sea_price?: number | null
          searchable_attributes?: string[] | null
          shipping_cost_iqd?: number | null
          shipping_type?: string | null
          short_summary?: Json | null
          slug: string
          sold_count?: number
          taobao_availability_cache?: Json | null
          taobao_last_sync_at?: string | null
          taobao_sync_status?: string | null
          taobao_url?: string | null
          taobao_variant_mapping?: Json | null
          ticket_reward?: number | null
          updated_at?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          advisor_notes?: string | null
          advisor_priority_boost?: number
          advisor_recommended?: boolean
          ai_content?: Json | null
          air_price?: number | null
          availability_type?: string
          brand?: string | null
          card_discounts?: Json | null
          category_id?: string | null
          cod_enabled?: boolean
          cod_fee_type?: string
          cod_fee_value?: number
          colors?: Json | null
          commission_air_iqd?: number | null
          commission_direct_iqd?: number | null
          commission_iqd?: number | null
          commission_land_iqd?: number
          commission_sea_iqd?: number | null
          cost_price?: number | null
          created_at?: string | null
          created_by_assistant?: string | null
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          direct_sale_price?: number | null
          direct_stock?: number | null
          display_order?: number
          featured?: boolean | null
          features?: Json | null
          has_in_stock?: boolean | null
          has_pre_order?: boolean | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          in_stock?: boolean | null
          is_pricing_updated?: boolean | null
          land_price?: number | null
          last_price_update?: string | null
          length_cm?: number | null
          link_direct_commission_to_cod?: boolean
          name?: string
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          original_price?: number | null
          original_price_usd?: number | null
          other_costs_iqd?: number | null
          pending_admin_review?: boolean
          personal_delivery_cost?: number
          points_reward?: number | null
          pre_order_fast_shipping_price?: number | null
          pre_order_free_shipping_price?: number | null
          pre_order_shipping_options?: Json | null
          pre_order_stock?: number | null
          price?: number
          price_usd?: number | null
          referral_earnings_iqd?: number
          round_up_price?: boolean | null
          sea_price?: number | null
          searchable_attributes?: string[] | null
          shipping_cost_iqd?: number | null
          shipping_type?: string | null
          short_summary?: Json | null
          slug?: string
          sold_count?: number
          taobao_availability_cache?: Json | null
          taobao_last_sync_at?: string | null
          taobao_sync_status?: string | null
          taobao_url?: string | null
          taobao_variant_mapping?: Json | null
          ticket_reward?: number | null
          updated_at?: string | null
          weight_kg?: number | null
          width_cm?: number | null
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
          active_card_frame_url: string | null
          avatar_url: string | null
          ban_reason: string | null
          bio: string | null
          birth_date: string | null
          cover_image_url: string | null
          created_at: string | null
          email: string | null
          email_notifications_enabled: boolean | null
          email_verified: boolean | null
          full_name: string | null
          gender: string | null
          governorate: string | null
          id: string
          is_banned: boolean | null
          last_active_at: string | null
          last_phone_change_at: string | null
          last_username_change_at: string | null
          phone_number: string | null
          phone_verification_status: string
          phone_verified: boolean
          selected_frame_id: string | null
          site_notifications: Json | null
          telegram_chat_id: string | null
          telegram_notifications: Json | null
          username: string
          warnings_count: number | null
        }
        Insert: {
          active_card_frame_url?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          birth_date?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          email?: string | null
          email_notifications_enabled?: boolean | null
          email_verified?: boolean | null
          full_name?: string | null
          gender?: string | null
          governorate?: string | null
          id: string
          is_banned?: boolean | null
          last_active_at?: string | null
          last_phone_change_at?: string | null
          last_username_change_at?: string | null
          phone_number?: string | null
          phone_verification_status?: string
          phone_verified?: boolean
          selected_frame_id?: string | null
          site_notifications?: Json | null
          telegram_chat_id?: string | null
          telegram_notifications?: Json | null
          username: string
          warnings_count?: number | null
        }
        Update: {
          active_card_frame_url?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          birth_date?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          email?: string | null
          email_notifications_enabled?: boolean | null
          email_verified?: boolean | null
          full_name?: string | null
          gender?: string | null
          governorate?: string | null
          id?: string
          is_banned?: boolean | null
          last_active_at?: string | null
          last_phone_change_at?: string | null
          last_username_change_at?: string | null
          phone_number?: string | null
          phone_verification_status?: string
          phone_verified?: boolean
          selected_frame_id?: string | null
          site_notifications?: Json | null
          telegram_chat_id?: string | null
          telegram_notifications?: Json | null
          username?: string
          warnings_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_selected_frame_id_fkey"
            columns: ["selected_frame_id"]
            isOneToOne: false
            referencedRelation: "avatar_frames"
            referencedColumns: ["id"]
          },
        ]
      }
      protection_plans: {
        Row: {
          annual_coverage_cap: number | null
          badge_text: string | null
          benefit_discount_category_ids: string[] | null
          benefit_discount_max_amount_monthly: number
          benefit_discount_percentage: number
          benefit_free_shipping_category_ids: string[] | null
          benefit_free_shipping_max_monthly: number
          benefit_free_shipping_methods: Json
          benefit_free_shipping_min_order: number
          coverage_months: number | null
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          display_order: number | null
          eligible_category_ids: string[] | null
          features: Json | null
          filament_discount_percentage: number | null
          filament_weekly_limit: number | null
          has_preventive_maintenance: boolean | null
          has_replacement_printer: boolean | null
          icon_name: string | null
          id: string
          info_description_ar: string | null
          info_description_en: string | null
          info_description_ku: string | null
          is_active: boolean | null
          is_addon_insurance: boolean
          maintenance_discount_percentage: number | null
          max_parts_discount_per_month: number | null
          max_price_iqd: number | null
          max_service_requests_per_month: number | null
          min_price_iqd: number | null
          monthly_price: number
          name_ar: string
          name_en: string
          name_ku: string | null
          parts_discount_categories: string[] | null
          parts_discount_limit_count: number | null
          parts_discount_limit_type: string | null
          parts_discount_percentage: number | null
          parts_discount_type: string | null
          parts_discount_value: number | null
          plan_type: Database["public"]["Enums"]["protection_plan_type"]
          preventive_maintenance_interval_months: number | null
          price_percentage: number | null
          priority_level: number | null
          requires_active_card: boolean
          updated_at: string | null
          waiting_period_days: number | null
          warranty_duration_months: number | null
        }
        Insert: {
          annual_coverage_cap?: number | null
          badge_text?: string | null
          benefit_discount_category_ids?: string[] | null
          benefit_discount_max_amount_monthly?: number
          benefit_discount_percentage?: number
          benefit_free_shipping_category_ids?: string[] | null
          benefit_free_shipping_max_monthly?: number
          benefit_free_shipping_methods?: Json
          benefit_free_shipping_min_order?: number
          coverage_months?: number | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          eligible_category_ids?: string[] | null
          features?: Json | null
          filament_discount_percentage?: number | null
          filament_weekly_limit?: number | null
          has_preventive_maintenance?: boolean | null
          has_replacement_printer?: boolean | null
          icon_name?: string | null
          id?: string
          info_description_ar?: string | null
          info_description_en?: string | null
          info_description_ku?: string | null
          is_active?: boolean | null
          is_addon_insurance?: boolean
          maintenance_discount_percentage?: number | null
          max_parts_discount_per_month?: number | null
          max_price_iqd?: number | null
          max_service_requests_per_month?: number | null
          min_price_iqd?: number | null
          monthly_price: number
          name_ar: string
          name_en: string
          name_ku?: string | null
          parts_discount_categories?: string[] | null
          parts_discount_limit_count?: number | null
          parts_discount_limit_type?: string | null
          parts_discount_percentage?: number | null
          parts_discount_type?: string | null
          parts_discount_value?: number | null
          plan_type: Database["public"]["Enums"]["protection_plan_type"]
          preventive_maintenance_interval_months?: number | null
          price_percentage?: number | null
          priority_level?: number | null
          requires_active_card?: boolean
          updated_at?: string | null
          waiting_period_days?: number | null
          warranty_duration_months?: number | null
        }
        Update: {
          annual_coverage_cap?: number | null
          badge_text?: string | null
          benefit_discount_category_ids?: string[] | null
          benefit_discount_max_amount_monthly?: number
          benefit_discount_percentage?: number
          benefit_free_shipping_category_ids?: string[] | null
          benefit_free_shipping_max_monthly?: number
          benefit_free_shipping_methods?: Json
          benefit_free_shipping_min_order?: number
          coverage_months?: number | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          eligible_category_ids?: string[] | null
          features?: Json | null
          filament_discount_percentage?: number | null
          filament_weekly_limit?: number | null
          has_preventive_maintenance?: boolean | null
          has_replacement_printer?: boolean | null
          icon_name?: string | null
          id?: string
          info_description_ar?: string | null
          info_description_en?: string | null
          info_description_ku?: string | null
          is_active?: boolean | null
          is_addon_insurance?: boolean
          maintenance_discount_percentage?: number | null
          max_parts_discount_per_month?: number | null
          max_price_iqd?: number | null
          max_service_requests_per_month?: number | null
          min_price_iqd?: number | null
          monthly_price?: number
          name_ar?: string
          name_en?: string
          name_ku?: string | null
          parts_discount_categories?: string[] | null
          parts_discount_limit_count?: number | null
          parts_discount_limit_type?: string | null
          parts_discount_percentage?: number | null
          parts_discount_type?: string | null
          parts_discount_value?: number | null
          plan_type?: Database["public"]["Enums"]["protection_plan_type"]
          preventive_maintenance_interval_months?: number | null
          price_percentage?: number | null
          priority_level?: number | null
          requires_active_card?: boolean
          updated_at?: string | null
          waiting_period_days?: number | null
          warranty_duration_months?: number | null
        }
        Relationships: []
      }
      purchase_drafts: {
        Row: {
          converted_at: string | null
          created_at: string | null
          id: string
          items: Json | null
          notes: string | null
          reverted_from_shipment: boolean | null
          status: string | null
          title: string | null
          total_value: number | null
          updated_at: string | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          reverted_from_shipment?: boolean | null
          status?: string | null
          title?: string | null
          total_value?: number | null
          updated_at?: string | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          reverted_from_shipment?: boolean | null
          status?: string | null
          title?: string | null
          total_value?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      random_filament_bans: {
        Row: {
          banned_at: string
          banned_by: string | null
          reason: string
          user_id: string
        }
        Insert: {
          banned_at?: string
          banned_by?: string | null
          reason?: string
          user_id: string
        }
        Update: {
          banned_at?: string
          banned_by?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      random_filament_offers: {
        Row: {
          allowed_product_ids: string[]
          category_id: string | null
          category_ids: string[]
          created_at: string
          description_ar: string | null
          display_order: number
          enabled: boolean
          id: string
          image_url: string | null
          price_iqd: number
          product_weights: Json
          sale_type: string
          title_ar: string
          updated_at: string
        }
        Insert: {
          allowed_product_ids?: string[]
          category_id?: string | null
          category_ids?: string[]
          created_at?: string
          description_ar?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          image_url?: string | null
          price_iqd?: number
          product_weights?: Json
          sale_type: string
          title_ar: string
          updated_at?: string
        }
        Update: {
          allowed_product_ids?: string[]
          category_id?: string | null
          category_ids?: string[]
          created_at?: string
          description_ar?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          image_url?: string | null
          price_iqd?: number
          product_weights?: Json
          sale_type?: string
          title_ar?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "random_filament_offers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      random_filament_orders: {
        Row: {
          cart_item_id: string | null
          category_id: string
          created_at: string
          id: string
          offer_id: string | null
          order_id: string | null
          price_iqd: number
          product_id: string
          product_option_id: string | null
          revealed_at: string | null
          sale_type: string
          selected_color: string | null
          user_id: string
        }
        Insert: {
          cart_item_id?: string | null
          category_id: string
          created_at?: string
          id?: string
          offer_id?: string | null
          order_id?: string | null
          price_iqd: number
          product_id: string
          product_option_id?: string | null
          revealed_at?: string | null
          sale_type: string
          selected_color?: string | null
          user_id: string
        }
        Update: {
          cart_item_id?: string | null
          category_id?: string
          created_at?: string
          id?: string
          offer_id?: string | null
          order_id?: string | null
          price_iqd?: number
          product_id?: string
          product_option_id?: string | null
          revealed_at?: string | null
          sale_type?: string
          selected_color?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "random_filament_orders_cart_item_id_fkey"
            columns: ["cart_item_id"]
            isOneToOne: false
            referencedRelation: "cart_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "random_filament_orders_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "random_filament_orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "random_filament_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "random_filament_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "random_filament_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "random_filament_orders_product_option_id_fkey"
            columns: ["product_option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "random_filament_orders_product_option_id_fkey"
            columns: ["product_option_id"]
            isOneToOne: false
            referencedRelation: "product_options_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      random_filament_settings: {
        Row: {
          category_ids: string[]
          created_at: string
          description_ar: string
          direct_price_iqd: number
          enabled: boolean
          id: string
          pre_order_price_iqd: number
          singleton: boolean
          title_ar: string
          updated_at: string
        }
        Insert: {
          category_ids?: string[]
          created_at?: string
          description_ar?: string
          direct_price_iqd?: number
          enabled?: boolean
          id?: string
          pre_order_price_iqd?: number
          singleton?: boolean
          title_ar?: string
          updated_at?: string
        }
        Update: {
          category_ids?: string[]
          created_at?: string
          description_ar?: string
          direct_price_iqd?: number
          enabled?: boolean
          id?: string
          pre_order_price_iqd?: number
          singleton?: boolean
          title_ar?: string
          updated_at?: string
        }
        Relationships: []
      }
      redemption_settings: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          max_daily_points: number | null
          min_points: number
          name_ar: string
          name_en: string | null
          name_ku: string | null
          points_per_unit: number
          redemption_type: string
          unit_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          max_daily_points?: number | null
          min_points?: number
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          points_per_unit?: number
          redemption_type: string
          unit_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          max_daily_points?: number | null
          min_points?: number
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          points_per_unit?: number
          redemption_type?: string
          unit_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      reel_interactions: {
        Row: {
          created_at: string
          id: string
          interaction_type: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_type: string
          reel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interaction_type?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_interactions_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "merchant_reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_views: {
        Row: {
          clicked_product: boolean | null
          completed: boolean | null
          created_at: string
          id: string
          reel_id: string
          skipped_early: boolean | null
          user_id: string | null
          watch_duration_seconds: number | null
        }
        Insert: {
          clicked_product?: boolean | null
          completed?: boolean | null
          created_at?: string
          id?: string
          reel_id: string
          skipped_early?: boolean | null
          user_id?: string | null
          watch_duration_seconds?: number | null
        }
        Update: {
          clicked_product?: boolean | null
          completed?: boolean | null
          created_at?: string
          id?: string
          reel_id?: string
          skipped_early?: boolean | null
          user_id?: string | null
          watch_duration_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reel_views_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "merchant_reels"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_coupon_usages: {
        Row: {
          buyer_user_id: string
          coupon_id: string
          created_at: string
          delivery_discount_iqd: number
          id: string
          order_id: string | null
          owner_earnings_iqd: number
          status: string
        }
        Insert: {
          buyer_user_id: string
          coupon_id: string
          created_at?: string
          delivery_discount_iqd?: number
          id?: string
          order_id?: string | null
          owner_earnings_iqd?: number
          status?: string
        }
        Update: {
          buyer_user_id?: string
          coupon_id?: string
          created_at?: string
          delivery_discount_iqd?: number
          id?: string
          order_id?: string | null
          owner_earnings_iqd?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "referral_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_coupons: {
        Row: {
          banner_style: string
          code: string
          created_at: string
          custom_message: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          owner_user_id: string
          total_earnings_iqd: number
          total_uses: number
          updated_at: string
        }
        Insert: {
          banner_style?: string
          code: string
          created_at?: string
          custom_message?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          owner_user_id: string
          total_earnings_iqd?: number
          total_uses?: number
          updated_at?: string
        }
        Update: {
          banner_style?: string
          code?: string
          created_at?: string
          custom_message?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          owner_user_id?: string
          total_earnings_iqd?: number
          total_uses?: number
          updated_at?: string
        }
        Relationships: []
      }
      referral_earnings_withdrawals: {
        Row: {
          amount_iqd: number
          id: string
          notes: string | null
          owner_user_id: string
          processed_at: string | null
          requested_at: string
          status: string
        }
        Insert: {
          amount_iqd: number
          id?: string
          notes?: string | null
          owner_user_id: string
          processed_at?: string | null
          requested_at?: string
          status?: string
        }
        Update: {
          amount_iqd?: number
          id?: string
          notes?: string | null
          owner_user_id?: string
          processed_at?: string | null
          requested_at?: string
          status?: string
        }
        Relationships: []
      }
      request_edit_history: {
        Row: {
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_edit_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "community_print_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_edit_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "community_print_requests_public"
            referencedColumns: ["id"]
          },
        ]
      }
      review_admin_replies: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          reply: string
          review_id: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          reply: string
          review_id: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          reply?: string
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_admin_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_answers: {
        Row: {
          answer: string
          answerer_id: string
          created_at: string
          id: string
          question_id: string
        }
        Insert: {
          answer: string
          answerer_id: string
          created_at?: string
          id?: string
          question_id: string
        }
        Update: {
          answer?: string
          answerer_id?: string
          created_at?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "review_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_helpful: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_helpful_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_questions: {
        Row: {
          asker_id: string
          created_at: string
          id: string
          product_id: string
          question: string
          review_id: string
        }
        Insert: {
          asker_id: string
          created_at?: string
          id?: string
          product_id: string
          question: string
          review_id: string
        }
        Update: {
          asker_id?: string
          created_at?: string
          id?: string
          product_id?: string
          question?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_questions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_reports: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_telegram_context: {
        Row: {
          id: string
          question_id: string
          telegram_chat_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          question_id: string
          telegram_chat_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          question_id?: string
          telegram_chat_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_telegram_context_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "review_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          additional_comments: Json | null
          comment: string | null
          created_at: string
          id: string
          is_auto_rating: boolean | null
          media_files: string[] | null
          points_awarded: number | null
          product_id: string
          rating: number
          reorder_count: number | null
          status: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          additional_comments?: Json | null
          comment?: string | null
          created_at?: string
          id?: string
          is_auto_rating?: boolean | null
          media_files?: string[] | null
          points_awarded?: number | null
          product_id: string
          rating: number
          reorder_count?: number | null
          status?: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          additional_comments?: Json | null
          comment?: string | null
          created_at?: string
          id?: string
          is_auto_rating?: boolean | null
          media_files?: string[] | null
          points_awarded?: number | null
          product_id?: string
          rating?: number
          reorder_count?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
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
          order_id: string | null
          printer_id: string | null
          template_id: string | null
          updated_at: string
          user_id: string | null
          warranty_expires_at: string | null
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          invoice_html: string
          notes?: string | null
          order_id?: string | null
          printer_id?: string | null
          template_id?: string | null
          updated_at?: string
          user_id?: string | null
          warranty_expires_at?: string | null
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          invoice_html?: string
          notes?: string | null
          order_id?: string | null
          printer_id?: string | null
          template_id?: string | null
          updated_at?: string
          user_id?: string | null
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
            foreignKeyName: "saved_invoices_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "order_items_for_serial"
            referencedColumns: ["store_printer_id"]
          },
          {
            foreignKeyName: "saved_invoices_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "store_printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_invoices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_print_reputation"
            referencedColumns: ["user_id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_hash: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_hash?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_hash?: string | null
          table_name?: string | null
          user_id?: string | null
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
        Relationships: []
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
          description_en: string | null
          description_ku: string | null
          id: string
          setting_key: string
          setting_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          id?: string
          setting_key: string
          setting_value: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          id?: string
          setting_key?: string
          setting_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      space_blaster_settings: {
        Row: {
          created_at: string
          entry_fee_tickets: number
          game_enabled: boolean
          id: string
          max_points_per_game: number
          points_per_score: number
          updated_at: string
          victory_bonus_points: number
          wave_bonus_points: number
        }
        Insert: {
          created_at?: string
          entry_fee_tickets?: number
          game_enabled?: boolean
          id?: string
          max_points_per_game?: number
          points_per_score?: number
          updated_at?: string
          victory_bonus_points?: number
          wave_bonus_points?: number
        }
        Update: {
          created_at?: string
          entry_fee_tickets?: number
          game_enabled?: boolean
          id?: string
          max_points_per_game?: number
          points_per_score?: number
          updated_at?: string
          victory_bonus_points?: number
          wave_bonus_points?: number
        }
        Relationships: []
      }
      stack_game_high_scores: {
        Row: {
          achieved_at: string
          all_time_high_score: number | null
          high_score: number
          id: string
          season: number
          user_id: string
        }
        Insert: {
          achieved_at?: string
          all_time_high_score?: number | null
          high_score?: number
          id?: string
          season?: number
          user_id: string
        }
        Update: {
          achieved_at?: string
          all_time_high_score?: number | null
          high_score?: number
          id?: string
          season?: number
          user_id?: string
        }
        Relationships: []
      }
      stack_game_leaderboard_prizes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          position: number
          prize_description_ar: string | null
          prize_image_url: string | null
          prize_name_ar: string
          product_id: string | null
          selected_color: string | null
          selected_option_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          position: number
          prize_description_ar?: string | null
          prize_image_url?: string | null
          prize_name_ar?: string
          product_id?: string | null
          selected_color?: string | null
          selected_option_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          prize_description_ar?: string | null
          prize_image_url?: string | null
          prize_name_ar?: string
          product_id?: string | null
          selected_color?: string | null
          selected_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stack_game_leaderboard_prizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stack_game_milestone_claims: {
        Row: {
          claimed_at: string
          id: string
          milestone_id: string
          score_achieved: number
          session_id: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          milestone_id: string
          score_achieved: number
          session_id?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          milestone_id?: string
          score_achieved?: number
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stack_game_milestone_claims_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "stack_game_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stack_game_milestone_claims_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "stack_game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      stack_game_milestones: {
        Row: {
          claimed_count: number
          created_at: string
          id: string
          is_active: boolean
          prize_description_ar: string | null
          prize_image_url: string | null
          prize_name_ar: string
          product_id: string | null
          selected_color: string | null
          selected_option_id: string | null
          stock: number
          target_score: number
          updated_at: string
        }
        Insert: {
          claimed_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          prize_description_ar?: string | null
          prize_image_url?: string | null
          prize_name_ar?: string
          product_id?: string | null
          selected_color?: string | null
          selected_option_id?: string | null
          stock?: number
          target_score?: number
          updated_at?: string
        }
        Update: {
          claimed_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          prize_description_ar?: string | null
          prize_image_url?: string | null
          prize_name_ar?: string
          product_id?: string | null
          selected_color?: string | null
          selected_option_id?: string | null
          stock?: number
          target_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stack_game_milestones_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stack_game_sessions: {
        Row: {
          ended_at: string | null
          id: string
          max_combo: number
          perfect_count: number
          points_awarded: number | null
          score: number
          session_token: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          max_combo?: number
          perfect_count?: number
          points_awarded?: number | null
          score?: number
          session_token: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          max_combo?: number
          perfect_count?: number
          points_awarded?: number | null
          score?: number
          session_token?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      stack_game_settings: {
        Row: {
          combo_bonus_multiplier: number
          created_at: string
          entry_fee_tickets: number
          game_combo_multiplier: number
          game_enabled: boolean
          game_perfect_bonus: number
          game_points_per_block: number
          id: string
          max_daily_plays: number | null
          perfect_bonus_points: number
          points_per_block: number
          season_ends_at: string | null
          season_name: string | null
          season_starts_at: string | null
          total_plays: number
          total_points_distributed: number
          updated_at: string
        }
        Insert: {
          combo_bonus_multiplier?: number
          created_at?: string
          entry_fee_tickets?: number
          game_combo_multiplier?: number
          game_enabled?: boolean
          game_perfect_bonus?: number
          game_points_per_block?: number
          id?: string
          max_daily_plays?: number | null
          perfect_bonus_points?: number
          points_per_block?: number
          season_ends_at?: string | null
          season_name?: string | null
          season_starts_at?: string | null
          total_plays?: number
          total_points_distributed?: number
          updated_at?: string
        }
        Update: {
          combo_bonus_multiplier?: number
          created_at?: string
          entry_fee_tickets?: number
          game_combo_multiplier?: number
          game_enabled?: boolean
          game_perfect_bonus?: number
          game_points_per_block?: number
          id?: string
          max_daily_plays?: number | null
          perfect_bonus_points?: number
          points_per_block?: number
          season_ends_at?: string | null
          season_name?: string | null
          season_starts_at?: string | null
          total_plays?: number
          total_points_distributed?: number
          updated_at?: string
        }
        Relationships: []
      }
      stack_game_winners: {
        Row: {
          awarded_at: string
          id: string
          position: number | null
          prize_name_ar: string
          prize_type: string
          product_id: string | null
          score: number | null
          season: number | null
          selected_color: string | null
          selected_option_id: string | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          id?: string
          position?: number | null
          prize_name_ar: string
          prize_type?: string
          product_id?: string | null
          score?: number | null
          season?: number | null
          selected_color?: string | null
          selected_option_id?: string | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          id?: string
          position?: number | null
          prize_name_ar?: string
          prize_type?: string
          product_id?: string | null
          score?: number | null
          season?: number | null
          selected_color?: string | null
          selected_option_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stack_game_winners_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stl_card_download_limits: {
        Row: {
          card_id: string
          created_at: string
          daily_download_limit: number | null
          id: string
          updated_at: string
        }
        Insert: {
          card_id: string
          created_at?: string
          daily_download_limit?: number | null
          id?: string
          updated_at?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          daily_download_limit?: number | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stl_card_download_limits_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "membership_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      stl_categories: {
        Row: {
          created_at: string
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          name_ku: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      stl_file_downloads: {
        Row: {
          downloaded_at: string
          file_id: string
          id: string
          user_id: string
        }
        Insert: {
          downloaded_at?: string
          file_id: string
          id?: string
          user_id: string
        }
        Update: {
          downloaded_at?: string
          file_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stl_file_downloads_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "stl_files"
            referencedColumns: ["id"]
          },
        ]
      }
      stl_files: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          cover_image_url: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          download_file_path: string | null
          downloads_count: number
          file_format: string | null
          file_size_bytes: number | null
          gallery_images: Json
          id: string
          min_card_tier_id: string | null
          model_preview_url: string | null
          price_points: number
          price_type: string
          rejection_reason: string | null
          status: string
          tags: string[]
          title_ar: string
          title_en: string | null
          title_ku: string | null
          updated_at: string
          uploader_id: string
          video_url: string | null
          views_count: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          download_file_path?: string | null
          downloads_count?: number
          file_format?: string | null
          file_size_bytes?: number | null
          gallery_images?: Json
          id?: string
          min_card_tier_id?: string | null
          model_preview_url?: string | null
          price_points?: number
          price_type?: string
          rejection_reason?: string | null
          status?: string
          tags?: string[]
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
          uploader_id: string
          video_url?: string | null
          views_count?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          download_file_path?: string | null
          downloads_count?: number
          file_format?: string | null
          file_size_bytes?: number | null
          gallery_images?: Json
          id?: string
          min_card_tier_id?: string | null
          model_preview_url?: string | null
          price_points?: number
          price_type?: string
          rejection_reason?: string | null
          status?: string
          tags?: string[]
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
          uploader_id?: string
          video_url?: string | null
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "stl_files_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "stl_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stl_files_min_card_tier_id_fkey"
            columns: ["min_card_tier_id"]
            isOneToOne: false
            referencedRelation: "membership_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_notifications: {
        Row: {
          created_at: string
          id: string
          notified_at: string | null
          product_id: string
          selected_color: string | null
          selected_option: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notified_at?: string | null
          product_id: string
          selected_color?: string | null
          selected_option?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notified_at?: string | null
          product_id?: string
          selected_color?: string | null
          selected_option?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_notifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_followers: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_followers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "merchant_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_followers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "merchant_applications_owner_view"
            referencedColumns: ["id"]
          },
        ]
      }
      store_printers: {
        Row: {
          activation_date: string | null
          buyer_user_id: string | null
          created_at: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          is_registered: boolean | null
          model_name: string
          model_name_ar: string
          order_id: string | null
          order_item_id: string | null
          qr_code_data: string | null
          serial_number: string
          sold_at: string | null
          status: string
          updated_at: string | null
          warranty_months: number | null
        }
        Insert: {
          activation_date?: string | null
          buyer_user_id?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_registered?: boolean | null
          model_name: string
          model_name_ar: string
          order_id?: string | null
          order_item_id?: string | null
          qr_code_data?: string | null
          serial_number: string
          sold_at?: string | null
          status?: string
          updated_at?: string | null
          warranty_months?: number | null
        }
        Update: {
          activation_date?: string | null
          buyer_user_id?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_registered?: boolean | null
          model_name?: string
          model_name_ar?: string
          order_id?: string | null
          order_item_id?: string | null
          qr_code_data?: string | null
          serial_number?: string
          sold_at?: string | null
          status?: string
          updated_at?: string | null
          warranty_months?: number | null
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
      story_sections: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          thumbnail_url: string | null
          title_ar: string
          title_en: string | null
          title_ku: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          thumbnail_url?: string | null
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          thumbnail_url?: string | null
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      story_videos: {
        Row: {
          created_at: string
          display_order: number
          duration_seconds: number | null
          id: string
          is_active: boolean
          section_id: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          section_id: string
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          section_id?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_videos_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "story_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_benefit_usage: {
        Row: {
          benefit_type: string
          delivery_method_key: string | null
          id: string
          order_id: string
          saved_amount: number
          subscription_id: string
          used_at: string
          user_id: string
          user_printer_id: string
        }
        Insert: {
          benefit_type: string
          delivery_method_key?: string | null
          id?: string
          order_id: string
          saved_amount?: number
          subscription_id: string
          used_at?: string
          user_id: string
          user_printer_id: string
        }
        Update: {
          benefit_type?: string
          delivery_method_key?: string | null
          id?: string
          order_id?: string
          saved_amount?: number
          subscription_id?: string
          used_at?: string
          user_id?: string
          user_printer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_benefit_usage_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "printer_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_benefit_usage_user_printer_id_fkey"
            columns: ["user_printer_id"]
            isOneToOne: false
            referencedRelation: "user_printers"
            referencedColumns: ["id"]
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
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
      ticket_promotions: {
        Row: {
          bonus_tickets: number
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          ends_at: string
          id: string
          is_active: boolean
          starts_at: string
          title_ar: string
          title_en: string | null
          title_ku: string | null
          updated_at: string
        }
        Insert: {
          bonus_tickets?: number
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          ends_at: string
          id?: string
          is_active?: boolean
          starts_at?: string
          title_ar: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Update: {
          bonus_tickets?: number
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          starts_at?: string
          title_ar?: string
          title_en?: string | null
          title_ku?: string | null
          updated_at?: string
        }
        Relationships: []
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
          label: string | null
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
          label?: string | null
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
          label?: string | null
          nearest_landmark?: string
          neighborhood?: string | null
          phone_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_avatar_frames: {
        Row: {
          frame_id: string
          id: string
          is_active: boolean
          purchased_at: string
          user_id: string
        }
        Insert: {
          frame_id: string
          id?: string
          is_active?: boolean
          purchased_at?: string
          user_id: string
        }
        Update: {
          frame_id?: string
          id?: string
          is_active?: boolean
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_avatar_frames_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "avatar_frames"
            referencedColumns: ["id"]
          },
        ]
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
          card_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_notified_cycle_index: number
          payment_method: string | null
          points_spent: number
          purchased_at: string
          updated_at: string
          user_id: string
          wallet_amount_paid: number | null
        }
        Insert: {
          card_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_notified_cycle_index?: number
          payment_method?: string | null
          points_spent?: number
          purchased_at?: string
          updated_at?: string
          user_id: string
          wallet_amount_paid?: number | null
        }
        Update: {
          card_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_notified_cycle_index?: number
          payment_method?: string | null
          points_spent?: number
          purchased_at?: string
          updated_at?: string
          user_id?: string
          wallet_amount_paid?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "membership_cards"
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
      user_level_prize_claims: {
        Row: {
          created_at: string
          delivered_at: string | null
          granted_at: string | null
          id: string
          level_number: number
          notes: string | null
          prize_id: string
          shipped_at: string | null
          shipping_address_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          granted_at?: string | null
          id?: string
          level_number: number
          notes?: string | null
          prize_id: string
          shipped_at?: string | null
          shipping_address_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          granted_at?: string | null
          id?: string
          level_number?: number
          notes?: string | null
          prize_id?: string
          shipped_at?: string | null
          shipping_address_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_level_prize_claims_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "level_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_points: {
        Row: {
          available_points: number
          created_at: string
          current_level_number: number
          current_level_xp: number
          id: string
          level: string | null
          redeemed_points: number
          total_earned: number | null
          total_points: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_points?: number
          created_at?: string
          current_level_number?: number
          current_level_xp?: number
          id?: string
          level?: string | null
          redeemed_points?: number
          total_earned?: number | null
          total_points?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_points?: number
          created_at?: string
          current_level_number?: number
          current_level_xp?: number
          id?: string
          level?: string | null
          redeemed_points?: number
          total_earned?: number | null
          total_points?: number
          total_xp?: number
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
      user_profile_preferences: {
        Row: {
          created_at: string
          quick_actions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          quick_actions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          quick_actions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profile_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profile_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profile_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_print_reputation"
            referencedColumns: ["user_id"]
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
          offer_id: string | null
          order_id: string | null
          order_status: string
          ordered_at: string | null
          product_id: string | null
          product_image: string | null
          product_name: string | null
          product_name_ar: string | null
          product_price: number
          product_title: string | null
          purchase_id: string | null
          purchased_at: string
          shipment_request_id: string | null
          shipped_at: string | null
          source_type: string
          status: string | null
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
          offer_id?: string | null
          order_id?: string | null
          order_status?: string
          ordered_at?: string | null
          product_id?: string | null
          product_image?: string | null
          product_name?: string | null
          product_name_ar?: string | null
          product_price?: number
          product_title?: string | null
          purchase_id?: string | null
          purchased_at?: string
          shipment_request_id?: string | null
          shipped_at?: string | null
          source_type?: string
          status?: string | null
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
          offer_id?: string | null
          order_id?: string | null
          order_status?: string
          ordered_at?: string | null
          product_id?: string | null
          product_image?: string | null
          product_name?: string | null
          product_name_ar?: string | null
          product_price?: number
          product_title?: string | null
          purchase_id?: string | null
          purchased_at?: string
          shipment_request_id?: string | null
          shipped_at?: string | null
          source_type?: string
          status?: string | null
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
      vip_free_game_plays: {
        Row: {
          created_at: string
          game_type: string
          id: string
          played_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_type: string
          id?: string
          played_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_type?: string
          id?: string
          played_date?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          admin_notes: string | null
          amount: number
          balance_after: number | null
          balance_before: number | null
          breakdown: Json | null
          created_at: string
          description: string | null
          id: string
          idempotency_key: string | null
          order_id: string | null
          payment_method: string | null
          payment_proof_url: string | null
          status: string
          stripe_session_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          breakdown?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          status?: string
          stripe_session_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          breakdown?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          status?: string
          stripe_session_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      web_vitals: {
        Row: {
          connection_type: string | null
          created_at: string
          device_pixel_ratio: number | null
          id: string
          metric_id: string | null
          metric_name: string
          metric_rating: string | null
          metric_value: number
          navigation_type: string | null
          path: string | null
          user_agent: string | null
          user_id: string | null
          viewport_width: number | null
        }
        Insert: {
          connection_type?: string | null
          created_at?: string
          device_pixel_ratio?: number | null
          id?: string
          metric_id?: string | null
          metric_name: string
          metric_rating?: string | null
          metric_value: number
          navigation_type?: string | null
          path?: string | null
          user_agent?: string | null
          user_id?: string | null
          viewport_width?: number | null
        }
        Update: {
          connection_type?: string | null
          created_at?: string
          device_pixel_ratio?: number | null
          id?: string
          metric_id?: string | null
          metric_name?: string
          metric_rating?: string | null
          metric_value?: number
          navigation_type?: string | null
          path?: string | null
          user_agent?: string | null
          user_id?: string | null
          viewport_width?: number | null
        }
        Relationships: []
      }
      wish_likes: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
          wish_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
          wish_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
          wish_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wish_likes_wish_id_fkey"
            columns: ["wish_id"]
            isOneToOne: false
            referencedRelation: "wishes"
            referencedColumns: ["id"]
          },
        ]
      }
      wishes: {
        Row: {
          created_at: string | null
          description: string | null
          fulfilled_at: string | null
          id: string
          image_url: string | null
          likes_count: number | null
          price: number | null
          reward_bonus_points: number | null
          reward_discount_percent: number | null
          reward_free_shipping: boolean | null
          reward_gift_description: string | null
          rewards_claimed: boolean | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          fulfilled_at?: string | null
          id?: string
          image_url?: string | null
          likes_count?: number | null
          price?: number | null
          reward_bonus_points?: number | null
          reward_discount_percent?: number | null
          reward_free_shipping?: boolean | null
          reward_gift_description?: string | null
          rewards_claimed?: boolean | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          fulfilled_at?: string | null
          id?: string
          image_url?: string | null
          likes_count?: number | null
          price?: number | null
          reward_bonus_points?: number | null
          reward_discount_percent?: number | null
          reward_free_shipping?: boolean | null
          reward_gift_description?: string | null
          rewards_claimed?: boolean | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      community_complaints_reported_view: {
        Row: {
          complainant_id: string | null
          complaint_type: string | null
          created_at: string | null
          description: string | null
          id: string | null
          reported_user_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          complainant_id?: string | null
          complaint_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          reported_user_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          complainant_id?: string | null
          complaint_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          reported_user_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      community_complaints_safe: {
        Row: {
          complainant_id: string | null
          complaint_type: string | null
          created_at: string | null
          description: string | null
          id: string | null
          images: string[] | null
          offer_id: string | null
          priority: string | null
          reported_merchant_id: string | null
          reported_user_id: string | null
          request_id: string | null
          resolved_at: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          complainant_id?: string | null
          complaint_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          images?: string[] | null
          offer_id?: string | null
          priority?: string | null
          reported_merchant_id?: string | null
          reported_user_id?: string | null
          request_id?: string | null
          resolved_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          complainant_id?: string | null
          complaint_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          images?: string[] | null
          offer_id?: string | null
          priority?: string | null
          reported_merchant_id?: string | null
          reported_user_id?: string | null
          request_id?: string | null
          resolved_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_complaints_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "community_print_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_complaints_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "community_print_requests_public"
            referencedColumns: ["id"]
          },
        ]
      }
      community_customer_profiles_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          frame_url: string | null
          id: string | null
          is_suspended: boolean | null
          is_verified: boolean | null
          reputation_score: number | null
          total_requests_made: number | null
          total_requests_received: number | null
          total_spent: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: never
          bio?: never
          created_at?: string | null
          display_name?: never
          frame_url?: string | null
          id?: string | null
          is_suspended?: boolean | null
          is_verified?: boolean | null
          reputation_score?: number | null
          total_requests_made?: number | null
          total_requests_received?: number | null
          total_spent?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: never
          bio?: never
          created_at?: string | null
          display_name?: never
          frame_url?: string | null
          id?: string | null
          is_suspended?: boolean | null
          is_verified?: boolean | null
          reputation_score?: number | null
          total_requests_made?: number | null
          total_requests_received?: number | null
          total_spent?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      community_print_requests_public: {
        Row: {
          accepted_at: string | null
          accepted_offer_id: string | null
          colors: string | null
          created_at: string | null
          customer_confirmed_at: string | null
          customer_governorate: string | null
          delivered_at: string | null
          description: string | null
          escrow_amount: number | null
          id: string | null
          image_url: string | null
          images: string[] | null
          material_type: string | null
          notes: string | null
          quantity: number | null
          reference_links: string[] | null
          size: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          video_url: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_offer_id?: string | null
          colors?: string | null
          created_at?: string | null
          customer_confirmed_at?: string | null
          customer_governorate?: string | null
          delivered_at?: string | null
          description?: string | null
          escrow_amount?: number | null
          id?: string | null
          image_url?: string | null
          images?: string[] | null
          material_type?: string | null
          notes?: string | null
          quantity?: number | null
          reference_links?: string[] | null
          size?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_offer_id?: string | null
          colors?: string | null
          created_at?: string | null
          customer_confirmed_at?: string | null
          customer_governorate?: string | null
          delivered_at?: string | null
          description?: string | null
          escrow_amount?: number | null
          id?: string | null
          image_url?: string | null
          images?: string[] | null
          material_type?: string | null
          notes?: string | null
          quantity?: number | null
          reference_links?: string[] | null
          size?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_print_requests_accepted_offer_id_fkey"
            columns: ["accepted_offer_id"]
            isOneToOne: false
            referencedRelation: "print_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_methods_admin: {
        Row: {
          actual_cost: number | null
          base_price: number | null
          base_price_category_id: string | null
          base_price_units_per_delivery: number | null
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          display_order: number | null
          free_delivery_enabled: boolean | null
          free_delivery_min_order: number | null
          icon: string | null
          id: string | null
          is_active: boolean | null
          method_key: string | null
          name_ar: string | null
          name_en: string | null
          name_ku: string | null
          updated_at: string | null
        }
        Insert: {
          actual_cost?: number | null
          base_price?: number | null
          base_price_category_id?: string | null
          base_price_units_per_delivery?: number | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number | null
          free_delivery_enabled?: boolean | null
          free_delivery_min_order?: number | null
          icon?: string | null
          id?: string | null
          is_active?: boolean | null
          method_key?: string | null
          name_ar?: string | null
          name_en?: string | null
          name_ku?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_cost?: number | null
          base_price?: number | null
          base_price_category_id?: string | null
          base_price_units_per_delivery?: number | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          display_order?: number | null
          free_delivery_enabled?: boolean | null
          free_delivery_min_order?: number | null
          icon?: string | null
          id?: string | null
          is_active?: boolean | null
          method_key?: string | null
          name_ar?: string | null
          name_en?: string | null
          name_ku?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_methods_base_price_category_id_fkey"
            columns: ["base_price_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_applications_owner_view: {
        Row: {
          away_message: string | null
          badge_tier: string | null
          bio: string | null
          city: string | null
          created_at: string | null
          display_name: string | null
          fee_status: string | null
          fee_transaction_id: string | null
          id: string | null
          inquiry_template: string | null
          is_away: boolean | null
          is_verified: boolean | null
          phone_number: string | null
          registration_fee: number | null
          rejected_at: string | null
          selected_frame_id: string | null
          social_links: Json | null
          specialty: string | null
          status: string | null
          store_image_url: string | null
          store_layout: string | null
          store_pause_end_date: string | null
          store_pause_message: string | null
          store_paused: boolean | null
          updated_at: string | null
          user_id: string | null
          welcome_message: string | null
        }
        Insert: {
          away_message?: string | null
          badge_tier?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          fee_status?: string | null
          fee_transaction_id?: string | null
          id?: string | null
          inquiry_template?: string | null
          is_away?: boolean | null
          is_verified?: boolean | null
          phone_number?: string | null
          registration_fee?: number | null
          rejected_at?: string | null
          selected_frame_id?: string | null
          social_links?: Json | null
          specialty?: string | null
          status?: string | null
          store_image_url?: string | null
          store_layout?: string | null
          store_pause_end_date?: string | null
          store_pause_message?: string | null
          store_paused?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          welcome_message?: string | null
        }
        Update: {
          away_message?: string | null
          badge_tier?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          fee_status?: string | null
          fee_transaction_id?: string | null
          id?: string | null
          inquiry_template?: string | null
          is_away?: boolean | null
          is_verified?: boolean | null
          phone_number?: string | null
          registration_fee?: number | null
          rejected_at?: string | null
          selected_frame_id?: string | null
          social_links?: Json | null
          specialty?: string | null
          status?: string | null
          store_image_url?: string | null
          store_layout?: string | null
          store_pause_end_date?: string | null
          store_pause_message?: string | null
          store_paused?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_applications_selected_frame_id_fkey"
            columns: ["selected_frame_id"]
            isOneToOne: false
            referencedRelation: "avatar_frames"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_debt_self: {
        Row: {
          debt_suspended: boolean | null
          debt_suspended_at: string | null
          id: string | null
          total_debt: number | null
        }
        Insert: {
          debt_suspended?: boolean | null
          debt_suspended_at?: string | null
          id?: string | null
          total_debt?: number | null
        }
        Update: {
          debt_suspended?: boolean | null
          debt_suspended_at?: string | null
          id?: string | null
          total_debt?: number | null
        }
        Relationships: []
      }
      merchant_public_profiles_admin: {
        Row: {
          accepted_payment_methods: Json | null
          badge_tier: string | null
          bio: string | null
          city: string | null
          created_at: string | null
          debt_suspended: boolean | null
          debt_suspended_at: string | null
          delivery_price_iqd: number | null
          delivery_rules: Json | null
          display_name: string | null
          id: string | null
          is_verified: boolean | null
          selected_frame_id: string | null
          social_links: Json | null
          specialty: string | null
          store_background_blur: number | null
          store_background_type: string | null
          store_background_value: string | null
          store_image_url: string | null
          store_layout: string | null
          store_slug: string | null
          total_debt: number | null
          updated_at: string | null
        }
        Insert: {
          accepted_payment_methods?: Json | null
          badge_tier?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          debt_suspended?: boolean | null
          debt_suspended_at?: string | null
          delivery_price_iqd?: number | null
          delivery_rules?: Json | null
          display_name?: string | null
          id?: string | null
          is_verified?: boolean | null
          selected_frame_id?: string | null
          social_links?: Json | null
          specialty?: string | null
          store_background_blur?: number | null
          store_background_type?: string | null
          store_background_value?: string | null
          store_image_url?: string | null
          store_layout?: string | null
          store_slug?: string | null
          total_debt?: number | null
          updated_at?: string | null
        }
        Update: {
          accepted_payment_methods?: Json | null
          badge_tier?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          debt_suspended?: boolean | null
          debt_suspended_at?: string | null
          delivery_price_iqd?: number | null
          delivery_rules?: Json | null
          display_name?: string | null
          id?: string | null
          is_verified?: boolean | null
          selected_frame_id?: string | null
          social_links?: Json | null
          specialty?: string | null
          store_background_blur?: number | null
          store_background_type?: string | null
          store_background_value?: string | null
          store_image_url?: string | null
          store_layout?: string | null
          store_slug?: string | null
          total_debt?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_public_profiles_selected_frame_id_fkey"
            columns: ["selected_frame_id"]
            isOneToOne: false
            referencedRelation: "avatar_frames"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_rating_stats: {
        Row: {
          average_rating: number | null
          five_stars: number | null
          four_stars: number | null
          merchant_id: string | null
          one_star: number | null
          three_stars: number | null
          total_ratings: number | null
          two_stars: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_ratings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_ratings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_applications_owner_view"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items_admin: {
        Row: {
          bundle_id: string | null
          color_image_url: string | null
          cost_price: number | null
          created_at: string | null
          custom_request_id: string | null
          customer_notes: string | null
          id: string | null
          is_gift: boolean | null
          order_id: string | null
          product_id: string | null
          product_name: string | null
          product_name_ar: string | null
          product_option_id: string | null
          quantity: number | null
          selected_color: string | null
          selected_option: string | null
          serial_number: string | null
          shipping_option_name_ar: string | null
          shipping_price_adjustment: number | null
          total_price: number | null
          unit_price: number | null
        }
        Relationships: []
      }
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
          {
            foreignKeyName: "orders_user_id_fkey_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_print_reputation"
            referencedColumns: ["user_id"]
          },
        ]
      }
      orders_admin: {
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
          auto_donation_amount: number | null
          cancelled_at: string | null
          card_discount_amount: number | null
          card_discount_level_name: string | null
          cod_fee: number | null
          confirmed_at: string | null
          created_at: string | null
          currency: string | null
          customer_paid_amount: number | null
          customs_declaration_number: string | null
          delivered_at: string | null
          delivery_method: string | null
          discount_amount: number | null
          estimated_delivery_date: string | null
          extra_donation_amount: number | null
          financial_notes: string | null
          governorate: string | null
          id: string | null
          internal_notes: string | null
          on_the_way_at: string | null
          order_number: string | null
          order_type: string | null
          package_dimensions: string | null
          paid_amount: number | null
          payment_method: string | null
          payment_status: string | null
          phone_number: string | null
          priority: string | null
          processing_at: string | null
          profit_amount: number | null
          purchased_at: string | null
          referral_coupon_id: string | null
          referral_owner_earnings_iqd: number | null
          remaining_amount: number | null
          serial_number_image_url: string | null
          shipped_at: string | null
          shipping_address: string | null
          shipping_duration_days: number | null
          shipping_notes: string | null
          shipping_route_type: string | null
          shipping_route_waypoints: Json | null
          status: string | null
          stock_deducted: boolean | null
          subtotal: number | null
          tax_amount: number | null
          tax_percentage: number | null
          total_amount: number | null
          updated_at: string | null
          user_confirmed_at: string | null
          user_confirmed_delivery: boolean | null
          user_id: string | null
        }
        Relationships: []
      }
      product_offers_admin: {
        Row: {
          colors: Json | null
          cost_price: number | null
          created_at: string | null
          currency: string | null
          description: string | null
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          gift_tickets: number | null
          id: string | null
          image_url: string | null
          images: string[] | null
          options: Json | null
          points_reward: number | null
          price: number | null
          show_in_cart: boolean | null
          status: string | null
          stock_quantity: number | null
          title: string | null
          title_ar: string | null
          title_en: string | null
          title_ku: string | null
          total_sold: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      product_offers_public: {
        Row: {
          colors: Json | null
          created_at: string | null
          currency: string | null
          description: string | null
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          gift_tickets: number | null
          id: string | null
          image_url: string | null
          images: string[] | null
          options: Json | null
          points_reward: number | null
          price: number | null
          show_in_cart: boolean | null
          status: string | null
          stock_quantity: number | null
          title: string | null
          title_ar: string | null
          title_en: string | null
          title_ku: string | null
          total_sold: number | null
          updated_at: string | null
        }
        Insert: {
          colors?: Json | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          gift_tickets?: number | null
          id?: string | null
          image_url?: string | null
          images?: string[] | null
          options?: Json | null
          points_reward?: number | null
          price?: number | null
          show_in_cart?: boolean | null
          status?: string | null
          stock_quantity?: number | null
          title?: string | null
          title_ar?: string | null
          title_en?: string | null
          title_ku?: string | null
          total_sold?: number | null
          updated_at?: string | null
        }
        Update: {
          colors?: Json | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          description_ku?: string | null
          gift_tickets?: number | null
          id?: string | null
          image_url?: string | null
          images?: string[] | null
          options?: Json | null
          points_reward?: number | null
          price?: number | null
          show_in_cart?: boolean | null
          status?: string | null
          stock_quantity?: number | null
          title?: string | null
          title_ar?: string | null
          title_en?: string | null
          title_ku?: string | null
          total_sold?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_options_admin: {
        Row: {
          available_for_direct_sale: boolean | null
          available_for_pre_order: boolean | null
          cost_iqd: number | null
          cost_usd: number | null
          created_at: string | null
          id: string | null
          image_url: string | null
          in_stock: boolean | null
          name: string | null
          name_ar: string | null
          name_en: string | null
          name_ku: string | null
          price_adjustment: number | null
          product_id: string | null
          stock_quantity: number | null
          taobao_available: boolean | null
          taobao_last_sync_at: string | null
          taobao_sku_id: string | null
        }
        Insert: {
          available_for_direct_sale?: boolean | null
          available_for_pre_order?: boolean | null
          cost_iqd?: number | null
          cost_usd?: number | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          in_stock?: boolean | null
          name?: string | null
          name_ar?: string | null
          name_en?: string | null
          name_ku?: string | null
          price_adjustment?: number | null
          product_id?: string | null
          stock_quantity?: number | null
          taobao_available?: boolean | null
          taobao_last_sync_at?: string | null
          taobao_sku_id?: string | null
        }
        Update: {
          available_for_direct_sale?: boolean | null
          available_for_pre_order?: boolean | null
          cost_iqd?: number | null
          cost_usd?: number | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          in_stock?: boolean | null
          name?: string | null
          name_ar?: string | null
          name_en?: string | null
          name_ku?: string | null
          price_adjustment?: number | null
          product_id?: string | null
          stock_quantity?: number | null
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
      products_admin: {
        Row: {
          ai_content: Json | null
          air_price: number | null
          availability_type: string | null
          brand: string | null
          card_discounts: Json | null
          category_id: string | null
          cod_enabled: boolean | null
          cod_fee_type: string | null
          cod_fee_value: number | null
          colors: Json | null
          commission_air_iqd: number | null
          commission_direct_iqd: number | null
          commission_iqd: number | null
          commission_land_iqd: number | null
          commission_sea_iqd: number | null
          cost_price: number | null
          created_at: string | null
          created_by_assistant: string | null
          currency: string | null
          description: string | null
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          direct_sale_price: number | null
          direct_stock: number | null
          display_order: number | null
          featured: boolean | null
          features: Json | null
          has_in_stock: boolean | null
          has_pre_order: boolean | null
          height_cm: number | null
          id: string | null
          image_url: string | null
          images: string[] | null
          in_stock: boolean | null
          is_pricing_updated: boolean | null
          land_price: number | null
          last_price_update: string | null
          length_cm: number | null
          link_direct_commission_to_cod: boolean | null
          name: string | null
          name_ar: string | null
          name_en: string | null
          name_ku: string | null
          original_price: number | null
          original_price_usd: number | null
          other_costs_iqd: number | null
          pending_admin_review: boolean | null
          personal_delivery_cost: number | null
          points_reward: number | null
          pre_order_fast_shipping_price: number | null
          pre_order_free_shipping_price: number | null
          pre_order_shipping_options: Json | null
          pre_order_stock: number | null
          price: number | null
          price_usd: number | null
          referral_earnings_iqd: number | null
          round_up_price: boolean | null
          sea_price: number | null
          searchable_attributes: string[] | null
          shipping_cost_iqd: number | null
          shipping_type: string | null
          short_summary: Json | null
          slug: string | null
          sold_count: number | null
          taobao_availability_cache: Json | null
          taobao_last_sync_at: string | null
          taobao_sync_status: string | null
          taobao_url: string | null
          taobao_variant_mapping: Json | null
          ticket_reward: number | null
          updated_at: string | null
          weight_kg: number | null
          width_cm: number | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          active_card_frame_url: string | null
          avatar_url: string | null
          bio: string | null
          cover_image_url: string | null
          created_at: string | null
          full_name: string | null
          gender: string | null
          id: string | null
          last_active_at: string | null
          selected_frame_id: string | null
          username: string | null
        }
        Insert: {
          active_card_frame_url?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string | null
          last_active_at?: string | null
          selected_frame_id?: string | null
          username?: string | null
        }
        Update: {
          active_card_frame_url?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string | null
          last_active_at?: string | null
          selected_frame_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_selected_frame_id_fkey"
            columns: ["selected_frame_id"]
            isOneToOne: false
            referencedRelation: "avatar_frames"
            referencedColumns: ["id"]
          },
        ]
      }
      user_print_reputation: {
        Row: {
          avg_quality_stars: number | null
          avg_speed_stars: number | null
          avg_stars: number | null
          customer_receive_rate_percent: number | null
          customer_requests_made: number | null
          customer_requests_received: number | null
          merchant_accepted_jobs: number | null
          merchant_completed_jobs: number | null
          merchant_completion_percent: number | null
          ratings_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _admin_filtered_payload: {
        Args: { _exclude?: string[]; _payload: Json; _table_name: string }
        Returns: Json
      }
      _admin_order_items_full: {
        Args: never
        Returns: {
          bundle_id: string | null
          color_image_url: string | null
          cost_price: number | null
          created_at: string
          custom_request_id: string | null
          customer_notes: string | null
          id: string
          is_gift: boolean
          order_id: string
          product_id: string | null
          product_name: string
          product_name_ar: string
          product_option_id: string | null
          quantity: number
          rf_offer_id: string | null
          selected_color: string | null
          selected_option: string | null
          serial_number: string | null
          shipping_option_name_ar: string | null
          shipping_price_adjustment: number | null
          total_price: number
          unit_price: number
        }[]
        SetofOptions: {
          from: "*"
          to: "order_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      _admin_orders_full: {
        Args: never
        Returns: {
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
          auto_donation_amount: number
          cancelled_at: string | null
          card_discount_amount: number | null
          card_discount_level_name: string | null
          cod_fee: number
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_paid_amount: number | null
          customs_declaration_number: string | null
          delivered_at: string | null
          delivery_method: string | null
          discount_amount: number | null
          estimated_delivery_date: string | null
          extra_donation_amount: number
          financial_notes: string | null
          governorate: string
          id: string
          internal_notes: string | null
          on_the_way_at: string | null
          order_number: string
          order_type: string | null
          package_dimensions: string | null
          paid_amount: number | null
          payment_method: string | null
          payment_status: string | null
          phone_number: string
          priority: string | null
          processing_at: string | null
          profit_amount: number | null
          purchased_at: string | null
          referral_coupon_id: string | null
          referral_owner_earnings_iqd: number
          remaining_amount: number | null
          serial_number_image_url: string | null
          shipped_at: string | null
          shipping_address: string
          shipping_duration_days: number | null
          shipping_notes: string | null
          shipping_route_type: string | null
          shipping_route_waypoints: Json | null
          status: string
          stock_deducted: boolean | null
          subtotal: number | null
          tax_amount: number | null
          tax_percentage: number | null
          total_amount: number
          updated_at: string
          user_confirmed_at: string | null
          user_confirmed_delivery: boolean | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      _admin_product_offers_full: {
        Args: never
        Returns: {
          colors: Json | null
          cost_price: number | null
          created_at: string
          currency: string | null
          description: string | null
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          gift_tickets: number
          id: string
          image_url: string | null
          images: string[] | null
          options: Json | null
          points_reward: number | null
          price: number
          show_in_cart: boolean
          status: string
          stock_quantity: number | null
          title: string
          title_ar: string
          title_en: string | null
          title_ku: string | null
          total_sold: number | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "product_offers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      _admin_products_full: {
        Args: never
        Returns: {
          advisor_notes: string | null
          advisor_priority_boost: number
          advisor_recommended: boolean
          ai_content: Json | null
          air_price: number | null
          availability_type: string
          brand: string | null
          card_discounts: Json | null
          category_id: string | null
          cod_enabled: boolean
          cod_fee_type: string
          cod_fee_value: number
          colors: Json | null
          commission_air_iqd: number | null
          commission_direct_iqd: number | null
          commission_iqd: number | null
          commission_land_iqd: number
          commission_sea_iqd: number | null
          cost_price: number | null
          created_at: string | null
          created_by_assistant: string | null
          currency: string | null
          description: string | null
          description_ar: string | null
          description_en: string | null
          description_ku: string | null
          direct_sale_price: number | null
          direct_stock: number | null
          display_order: number
          featured: boolean | null
          features: Json | null
          has_in_stock: boolean | null
          has_pre_order: boolean | null
          height_cm: number | null
          id: string
          image_url: string | null
          images: string[] | null
          in_stock: boolean | null
          is_pricing_updated: boolean | null
          land_price: number | null
          last_price_update: string | null
          length_cm: number | null
          link_direct_commission_to_cod: boolean
          name: string
          name_ar: string
          name_en: string | null
          name_ku: string | null
          original_price: number | null
          original_price_usd: number | null
          other_costs_iqd: number | null
          pending_admin_review: boolean
          personal_delivery_cost: number
          points_reward: number | null
          pre_order_fast_shipping_price: number | null
          pre_order_free_shipping_price: number | null
          pre_order_shipping_options: Json | null
          pre_order_stock: number | null
          price: number
          price_usd: number | null
          referral_earnings_iqd: number
          round_up_price: boolean | null
          sea_price: number | null
          searchable_attributes: string[] | null
          shipping_cost_iqd: number | null
          shipping_type: string | null
          short_summary: Json | null
          slug: string
          sold_count: number
          taobao_availability_cache: Json | null
          taobao_last_sync_at: string | null
          taobao_sync_status: string | null
          taobao_url: string | null
          taobao_variant_mapping: Json | null
          ticket_reward: number | null
          updated_at: string | null
          weight_kg: number | null
          width_cm: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      _rf_weighted_pick: { Args: { p_items: Json }; Returns: string }
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
      add_random_filament_to_cart: {
        Args: { p_category_id: string; p_offer_id: string; p_quantity: number }
        Returns: Json
      }
      add_serial_number_to_order_item: {
        Args: {
          p_admin_id: string
          p_order_item_id: string
          p_serial_number: string
        }
        Returns: Json
      }
      add_user_level_xp: {
        Args: { p_amount: number; p_user_id: string }
        Returns: Json
      }
      add_user_points: {
        Args: { p_amount: number; p_source?: string; p_user_id: string }
        Returns: boolean
      }
      add_user_tickets: {
        Args: { p_amount: number; p_source?: string; p_user_id: string }
        Returns: boolean
      }
      admin_add_assistant_by_email: {
        Args: { _email: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      admin_adjust_order_inventory: {
        Args: {
          p_option_name?: string
          p_product_id: string
          p_quantity_change?: number
          p_selected_color?: string
        }
        Returns: undefined
      }
      admin_adjust_points: {
        Args: {
          p_amount: number
          p_description?: string
          p_source?: string
          p_user_id: string
        }
        Returns: string
      }
      admin_adjust_product_counters: {
        Args: {
          p_option_name?: string
          p_order_type?: string
          p_product_id: string
          p_quantity_change?: number
          p_selected_color?: string
        }
        Returns: undefined
      }
      admin_adjust_tickets: {
        Args: { p_amount: number; p_source?: string; p_user_id: string }
        Returns: boolean
      }
      admin_adjust_wallet: {
        Args: {
          p_amount: number
          p_description: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      admin_approve_transaction: {
        Args: { p_transaction_id: string }
        Returns: boolean
      }
      admin_award_crossy_road_winners: {
        Args: { p_next_season_starts_at?: string }
        Returns: Json
      }
      admin_award_knife_rain_winners: { Args: never; Returns: Json }
      admin_award_stack_winners: { Args: never; Returns: Json }
      admin_create_order: {
        Args: { _values: Json }
        Returns: {
          created_at: string
          id: string
          order_number: string
          status: string
          total_amount: number
          user_id: string
        }[]
      }
      admin_create_product: { Args: { _values: Json }; Returns: string }
      admin_delete_levo_card: { Args: { p_card_id: string }; Returns: Json }
      admin_delete_order: { Args: { _order_id: string }; Returns: undefined }
      admin_delete_product: {
        Args: { _product_id: string }
        Returns: undefined
      }
      admin_generate_levo_cards: {
        Args: { p_batch_label: string; p_count: number }
        Returns: Json
      }
      admin_get_levo_card_details: {
        Args: { p_card_number: string }
        Returns: Json
      }
      admin_get_order_items_full: {
        Args: { p_order_ids: string[] }
        Returns: {
          bundle_id: string | null
          color_image_url: string | null
          cost_price: number | null
          created_at: string
          custom_request_id: string | null
          customer_notes: string | null
          id: string
          is_gift: boolean
          order_id: string
          product_id: string | null
          product_name: string
          product_name_ar: string
          product_option_id: string | null
          quantity: number
          rf_offer_id: string | null
          selected_color: string | null
          selected_option: string | null
          serial_number: string | null
          shipping_option_name_ar: string | null
          shipping_price_adjustment: number | null
          total_price: number
          unit_price: number
        }[]
        SetofOptions: {
          from: "*"
          to: "order_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_get_orders_full: {
        Args: { p_order_ids?: string[] }
        Returns: {
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
          auto_donation_amount: number
          cancelled_at: string | null
          card_discount_amount: number | null
          card_discount_level_name: string | null
          cod_fee: number
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_paid_amount: number | null
          customs_declaration_number: string | null
          delivered_at: string | null
          delivery_method: string | null
          discount_amount: number | null
          estimated_delivery_date: string | null
          extra_donation_amount: number
          financial_notes: string | null
          governorate: string
          id: string
          internal_notes: string | null
          on_the_way_at: string | null
          order_number: string
          order_type: string | null
          package_dimensions: string | null
          paid_amount: number | null
          payment_method: string | null
          payment_status: string | null
          phone_number: string
          priority: string | null
          processing_at: string | null
          profit_amount: number | null
          purchased_at: string | null
          referral_coupon_id: string | null
          referral_owner_earnings_iqd: number
          remaining_amount: number | null
          serial_number_image_url: string | null
          shipped_at: string | null
          shipping_address: string
          shipping_duration_days: number | null
          shipping_notes: string | null
          shipping_route_type: string | null
          shipping_route_waypoints: Json | null
          status: string
          stock_deducted: boolean | null
          subtotal: number | null
          tax_amount: number | null
          tax_percentage: number | null
          total_amount: number
          updated_at: string
          user_confirmed_at: string | null
          user_confirmed_delivery: boolean | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_get_user_card_cycles_summary: {
        Args: {
          p_min_duration_days?: number
          p_only_active?: boolean
          p_search?: string
        }
        Returns: {
          card_id: string
          card_key: string
          card_name_ar: string
          card_name_en: string
          current_cycle_index: number
          cycle_end: string
          cycle_start: string
          days_left_in_card: number
          days_left_in_cycle: number
          duration_days: number
          expires_at: string
          free_shipping_max_uses: number
          free_shipping_remaining_in_cycle: number
          free_shipping_used_in_cycle: number
          full_name: string
          is_active: boolean
          percentage_max_amount: number
          percentage_remaining_in_cycle: number
          percentage_used_in_cycle: number
          purchased_at: string
          redeemed_code: string
          total_cycles: number
          user_card_id: string
          user_id: string
          username: string
          validity_status: string
        }[]
      }
      admin_gift_loyalty_card: {
        Args: { p_admin_note?: string; p_card_id: string; p_user_id: string }
        Returns: Json
      }
      admin_list_assistants: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          user_id: string
        }[]
      }
      admin_quick_update_costs: {
        Args: {
          _options: Json
          _original_price_usd?: number
          _product_cost: number
          _product_id: string
        }
        Returns: {
          cost_price: number
          original_price_usd: number
        }[]
      }
      admin_release_levo_card: {
        Args: { p_assignment_id: string }
        Returns: Json
      }
      admin_remove_assistant: { Args: { _user_id: string }; Returns: undefined }
      admin_sync_product_options: {
        Args: { _options: Json; _product_id: string }
        Returns: undefined
      }
      admin_update_level_prize_claim: {
        Args: { p_claim_id: string; p_new_status: string; p_notes?: string }
        Returns: Json
      }
      admin_update_order: {
        Args: { _order_id: string; _updates: Json }
        Returns: undefined
      }
      admin_update_product:
        | { Args: { _product_id: string; _updates: Json }; Returns: undefined }
        | { Args: { _updates: Json }; Returns: undefined }
      apply_referral_coupon: {
        Args: { p_buyer_user_id: string; p_code: string }
        Returns: Json
      }
      approve_price_protection_claim: {
        Args: {
          p_admin_notes?: string
          p_claim_id: string
          p_refund_amount: number
        }
        Returns: Json
      }
      audit_product_stock_discrepancies: {
        Args: never
        Returns: {
          actual_sold_qty: number
          current_total_stock: number
          expected_remaining: number
          missing_colors: string[]
          product_id: string
          product_name: string
          recorded_sold_count: number
          shortfall: number
          total_purchased: number
        }[]
      }
      auto_award_expired_seasons: { Args: never; Returns: Json }
      auto_confirm_delivery: { Args: never; Returns: undefined }
      auto_hide_stale_priced_products: { Args: never; Returns: number }
      ban_user_for_unreceived_random_filament: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: Json
      }
      calculate_merchant_badge_tier:
        | { Args: { p_merchant_id: string }; Returns: string }
        | {
            Args: { p_merchant_id: string; p_settings?: Json }
            Returns: string
          }
      calculate_user_level: { Args: { points: number }; Returns: string }
      can_access_stl_library: { Args: { _uid: string }; Returns: boolean }
      can_read_print_file: { Args: { object_name: string }; Returns: boolean }
      cancel_order: {
        Args: { p_cancelled_by?: string; p_order_id: string }
        Returns: Json
      }
      check_card_discount:
        | {
            Args: {
              p_card_id: string
              p_category_id: string
              p_user_id: string
            }
            Returns: Json
          }
        | { Args: { p_category_id: string; p_user_id: string }; Returns: Json }
      check_crossy_road_milestone: {
        Args: { p_score: number; p_session_id?: string; p_user_id: string }
        Returns: Json
      }
      check_knife_rain_milestone: {
        Args: { p_score: number; p_session_id?: string; p_user_id: string }
        Returns: Json
      }
      check_merchant_debt_suspension: {
        Args: { p_merchant_user_id: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_action_type: string
          p_max_count: number
          p_user_id: string
          p_window_minutes: number
        }
        Returns: boolean
      }
      check_stack_milestone: {
        Args: { p_score: number; p_session_id?: string; p_user_id: string }
        Returns: Json
      }
      check_user_printer_warranty: { Args: never; Returns: Json }
      check_username_available: {
        Args: { username_to_check: string }
        Returns: boolean
      }
      check_vip_free_play:
        | { Args: { p_user_id: string }; Returns: boolean }
        | { Args: { p_game_type: string; p_user_id: string }; Returns: Json }
      claim_assistance_coupon: {
        Args: { p_coupon_id: string; p_user_id: string }
        Returns: string
      }
      claim_assistance_envelope: {
        Args: { p_envelope_id: string; p_user_id: string }
        Returns: boolean
      }
      claim_assistance_gift: {
        Args: { p_gift_id: string; p_user_id: string }
        Returns: boolean
      }
      claim_crossy_road_prize_to_cart: {
        Args: { p_milestone_id: string }
        Returns: undefined
      }
      claim_knife_rain_prize_to_cart: {
        Args: { p_milestone_id: string }
        Returns: Json
      }
      claim_stack_prize_to_cart: {
        Args: { p_milestone_id: string }
        Returns: Json
      }
      cleanup_expired_verification_codes: { Args: never; Returns: undefined }
      cleanup_old_coupon_attempts: { Args: never; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      complete_daily_task: { Args: { task_key_param: string }; Returns: Json }
      compute_cod_fee_from_settings: {
        Args: { _subtotal: number }
        Returns: number
      }
      compute_overall_print_score: {
        Args: {
          p_avg_quality_stars: number
          p_avg_speed_stars: number
          p_avg_stars: number
          p_completion_percent: number
          p_receive_rate_percent: number
        }
        Returns: number
      }
      compute_product_live_direct_sale_price: {
        Args: { p_product_id: string }
        Returns: number
      }
      compute_product_variant_direct_sale_price: {
        Args: { p_cost_iqd: number; p_product_id: string }
        Returns: number
      }
      compute_product_variant_direct_sale_prices: {
        Args: { p_items: Json }
        Returns: {
          cost_iqd: number
          direct_sale_price: number
          product_id: string
        }[]
      }
      compute_products_live_direct_sale_prices: {
        Args: { p_ids: string[] }
        Returns: {
          direct_sale_price: number
          product_id: string
        }[]
      }
      consume_subscription_benefit: {
        Args: {
          p_amount: number
          p_benefit_type: string
          p_delivery_method_key?: string
          p_order_id: string
          p_subscription_id: string
        }
        Returns: boolean
      }
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
      create_order_with_wallet_payment: {
        Args: {
          p_order_data: Json
          p_payment_amount: number
          p_user_id: string
        }
        Returns: string
      }
      create_random_filament_order: {
        Args: { p_category_id: string; p_offer_id: string }
        Returns: Json
      }
      credit_user_wallet: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      decrement_gacha_prize_stock: {
        Args: { p_prize_id: string }
        Returns: boolean
      }
      deduct_order_stock: { Args: { p_order_id: string }; Returns: undefined }
      deduct_prize_stock: {
        Args: { p_color?: string; p_option_name?: string; p_product_id: string }
        Returns: boolean
      }
      deduct_user_points: {
        Args: {
          p_amount: number
          p_description?: string
          p_source?: string
          p_user_id: string
        }
        Returns: string
      }
      deduct_user_tickets: {
        Args: { p_amount: number; p_user_id: string }
        Returns: boolean
      }
      deduct_wallet_balance: {
        Args: {
          p_amount: number
          p_description?: string
          p_idempotency_key?: string
          p_user_id: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_old_notifications: { Args: never; Returns: undefined }
      detect_price_protection_for_product: {
        Args: { p_new_price: number; p_product_id: string }
        Returns: number
      }
      donate_from_wallet:
        | { Args: { p_amount: number }; Returns: string }
        | {
            Args: { p_amount: number; p_display_name?: string }
            Returns: string
          }
      draw_competition_winner: { Args: { comp_id: string }; Returns: Json }
      draw_multiple_winners: { Args: { comp_id: string }; Returns: Json }
      end_crossy_road: {
        Args: {
          p_coins?: number
          p_score: number
          p_session_token: string
          p_steps?: number
        }
        Returns: Json
      }
      end_knife_rain: {
        Args: {
          p_knives?: number
          p_score: number
          p_session_token: string
          p_stage?: number
        }
        Returns: Json
      }
      end_stack_game: {
        Args: {
          p_max_combo: number
          p_perfect_count: number
          p_score: number
          p_session_token: string
        }
        Returns: Json
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enter_collect_letters_competition: {
        Args: { comp_id: string; quantity?: number }
        Returns: Json
      }
      enter_competition: {
        Args: {
          p_competition_id: string
          p_letter_awarded?: string
          p_prize_won?: Json
          p_team?: string
          p_ticket_count: number
          p_user_id: string
        }
        Returns: {
          error_message: string
          success: boolean
          ticket_id: string
          ticket_number: string
        }[]
      }
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
      finalize_and_reveal_rf_for_order:
        | { Args: { p_order_id: string }; Returns: undefined }
        | {
            Args: { p_only_sale_type?: string; p_order_id: string }
            Returns: undefined
          }
      gacha_market_buy_atomic: { Args: { p_listing_id: string }; Returns: Json }
      game_award_points: {
        Args: { p_amount: number; p_game_name: string; p_user_id: string }
        Returns: string
      }
      generate_cart_code: { Args: never; Returns: string }
      generate_conversation_code: { Args: never; Returns: string }
      generate_levo_card_number: { Args: never; Returns: string }
      generate_listing_code: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_referral_code:
        | { Args: never; Returns: string }
        | { Args: { user_username: string }; Returns: string }
      generate_request_code: { Args: never; Returns: string }
      generate_ticket_number: { Args: { comp_id: string }; Returns: string }
      get_active_subscription_benefits_for_user: {
        Args: { p_user_id: string }
        Returns: {
          discount_applicable_category_ids: string[]
          discount_max_amount_monthly: number
          discount_percentage: number
          discount_used: number
          end_date: string
          free_shipping_applicable_category_ids: string[]
          free_shipping_max_uses_monthly: number
          free_shipping_methods: Json
          free_shipping_min_order: number
          free_shipping_used: number
          is_benefits_active: boolean
          model_name_ar: string
          period_end: string
          period_start: string
          plan_badge_text: string
          plan_id: string
          plan_name_ar: string
          product_id: string
          serial_number: string
          start_date: string
          store_printer_id: string
          subscription_id: string
          user_printer_id: string
        }[]
      }
      get_card_free_shipping_used:
        | { Args: { p_card_id: string }; Returns: number }
        | { Args: { p_card_id: string; p_user_id: string }; Returns: number }
      get_card_percentage_discount_used:
        | { Args: { p_card_id: string }; Returns: number }
        | { Args: { p_card_id: string; p_user_id: string }; Returns: number }
      get_direct_sale_category_ids: {
        Args: never
        Returns: {
          category_id: string
        }[]
      }
      get_donations_stats: {
        Args: never
        Returns: {
          donor_count: number
          total_amount: number
          total_count: number
        }[]
      }
      get_internal_http_secret: { Args: { p_purpose: string }; Returns: string }
      get_merchant_debt: {
        Args: { p_merchant_user_id: string }
        Returns: number
      }
      get_order_wallet_log: {
        Args: { p_order_id: string }
        Returns: {
          amount: number
          balance_after: number
          balance_before: number
          breakdown: Json
          created_at: string
          description: string
          id: string
          idempotency_key: string
          payment_method: string
          status: string
          type: string
          user_id: string
        }[]
      }
      get_price_protection_current_price: {
        Args: { p_order_item_id: string }
        Returns: number
      }
      get_public_donations_feed: {
        Args: { p_limit?: number }
        Returns: {
          amount: number
          created_at: string
          display_name: string
          id: string
          order_short: string
          source: string
        }[]
      }
      get_public_profiles: {
        Args: { user_ids: string[] }
        Returns: {
          active_card_frame_url: string
          avatar_url: string
          bio: string
          cover_image_url: string
          full_name: string
          id: string
          last_active_at: string
          selected_frame_id: string
          username: string
        }[]
      }
      get_recent_donors: {
        Args: { p_limit?: number }
        Returns: {
          display_name: string
          donation_count: number
          last_donation_at: string
          total_amount: number
          user_id: string
        }[]
      }
      get_url_analytics_summary: {
        Args: { _days?: number; _platform?: string }
        Returns: Json
      }
      get_user_card_cycle: {
        Args: { p_card_id: string }
        Returns: {
          cycle_end: string
          cycle_index: number
          cycle_start: string
          duration_days: number
          total_cycles: number
        }[]
      }
      get_user_card_frame: {
        Args: { p_user_id: string }
        Returns: {
          frame_animation: string
          frame_url: string
        }[]
      }
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
      get_user_level: { Args: { p_user_id: string }; Returns: string }
      get_user_lock_key: { Args: { p_user_id: string }; Returns: number }
      get_warranty_discount_used: {
        Args: { p_user_printer_id: string }
        Returns: number
      }
      get_warranty_free_shipping_used: {
        Args: { p_user_printer_id: string }
        Returns: number
      }
      get_warranty_period_bounds: {
        Args: { p_user_printer_id: string }
        Returns: {
          period_end: string
          period_start: string
        }[]
      }
      gift_card_with_points: {
        Args: {
          p_card_id: string
          p_gifter_id: string
          p_message?: string
          p_recipient_id: string
        }
        Returns: Json
      }
      gift_card_with_wallet: {
        Args: {
          p_card_id: string
          p_gifter_id: string
          p_message?: string
          p_recipient_id: string
        }
        Returns: Json
      }
      grant_level_prize_coupon: {
        Args: { p_prize_id: string; p_user_id: string }
        Returns: undefined
      }
      has_admin_access: { Args: { _user_id: string }; Returns: boolean }
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
      levo_activate_card: { Args: { p_card_number: string }; Returns: Json }
      levo_release_card: { Args: { p_assignment_id: string }; Returns: Json }
      levo_subscribe_card: {
        Args: {
          p_amount: number
          p_assignment_id: string
          p_membership_card_id: string
          p_payment_method: string
        }
        Returns: Json
      }
      levo_upgrade_quote: {
        Args: { p_assignment_id: string; p_new_plan_id: string }
        Returns: Json
      }
      levo_upgrade_subscription: {
        Args: {
          p_amount_paid: number
          p_assignment_id: string
          p_new_plan_id: string
          p_payment_method: string
        }
        Returns: Json
      }
      link_random_filament_to_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      link_wallet_tx_to_order: {
        Args: {
          p_balance_before?: number
          p_breakdown: Json
          p_order_id: string
          p_transaction_id: string
        }
        Returns: undefined
      }
      log_client_error: {
        Args: { p_context?: Json; p_message: string; p_source: string }
        Returns: undefined
      }
      log_order_error: {
        Args: {
          p_context: string
          p_details?: Json
          p_error_code?: string
          p_error_message?: string
        }
        Returns: string
      }
      mark_url_analytics_converted: {
        Args: { _url_hash: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      normalize_levo_card_number: { Args: { p_input: string }; Returns: string }
      normalize_store_slug: { Args: { input: string }; Returns: string }
      normalize_text_key: { Args: { p_text: string }; Returns: string }
      notify_card_cycle_rollovers: { Args: never; Returns: number }
      notify_draw_happening: { Args: { comp_id: string }; Returns: undefined }
      pay_order_from_wallet: {
        Args: {
          p_amount: number
          p_order_id: string
          p_order_number: string
          p_user_id: string
        }
        Returns: string
      }
      process_stripe_wallet_deposit: {
        Args: {
          p_amount: number
          p_stripe_session_id: string
          p_user_id: string
        }
        Returns: Json
      }
      purchase_card_with_points: {
        Args: { p_card_id: string; p_user_id: string }
        Returns: Json
      }
      purchase_card_with_wallet: {
        Args: { p_card_id: string; p_user_id: string }
        Returns: Json
      }
      purchase_competition_ticket:
        | { Args: { comp_id: string }; Returns: Json }
        | { Args: { comp_id: string; quantity?: number }; Returns: Json }
      purchase_printer_subscription: {
        Args: {
          p_current_sub_id?: string
          p_is_upgrade?: boolean
          p_plan_id: string
          p_price: number
          p_printer_id: string
        }
        Returns: Json
      }
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
      purge_old_cancelled_orders: { Args: never; Returns: number }
      purge_oos_direct_cart_items: { Args: never; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalculate_user_level: { Args: { p_user_id: string }; Returns: Json }
      recompute_all_product_prices: { Args: never; Returns: number }
      recompute_product_prices: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      record_ad_watch_and_award: {
        Args: {
          p_session_id: string
          p_user_id: string
          p_watch_number: number
        }
        Returns: Json
      }
      record_listing_view: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      record_reel_view: {
        Args: {
          p_clicked_product?: boolean
          p_completed?: boolean
          p_reel_id: string
          p_skipped_early?: boolean
          p_user_id?: string
          p_watch_duration?: number
        }
        Returns: undefined
      }
      redeem_letters_prize: {
        Args: { p_competition_id: string; p_word: string }
        Returns: Json
      }
      redeem_points_store_product: {
        Args: { p_product_id: string }
        Returns: Json
      }
      refund_wallet_balance: {
        Args: {
          p_amount: number
          p_description?: string
          p_idempotency_key?: string
          p_user_id: string
        }
        Returns: string
      }
      register_printer_from_order: {
        Args: { p_serial_number: string; p_user_id: string }
        Returns: string
      }
      register_user_printer: {
        Args: { p_serial_number: string; p_user_id: string }
        Returns: string
      }
      reject_price_protection_claim: {
        Args: { p_claim_id: string; p_reason: string }
        Returns: Json
      }
      request_cancel_random_filament_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      request_level_prize_shipping: {
        Args: { p_address_id?: string; p_claim_id: string }
        Returns: Json
      }
      request_offer_shipment: {
        Args: { p_purchase_ids: string[] }
        Returns: Json
      }
      request_product_delivery: {
        Args: { p_product_ids: string[] }
        Returns: Json
      }
      reveal_random_filament_orders: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      rf_offer_stock_summary: { Args: { p_offer_id: string }; Returns: Json }
      search_users_for_gift: {
        Args: { p_query: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          username: string
        }[]
      }
      send_general_notification: {
        Args: { _message: string; _title: string; _type?: string }
        Returns: undefined
      }
      set_wallet_pin: { Args: { pin_code: string }; Returns: undefined }
      start_crossy_road: { Args: never; Returns: Json }
      start_knife_rain: { Args: never; Returns: Json }
      start_stack_game: { Args: never; Returns: Json }
      submit_knife_rain_score: {
        Args: { _session_id: string }
        Returns: {
          all_time_high_score: number | null
          best_stage: number
          high_score: number
          id: string
          season: number | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "knife_rain_high_scores"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_stack_game_score: {
        Args: { _session_id: string }
        Returns: {
          achieved_at: string
          all_time_high_score: number | null
          high_score: number
          id: string
          season: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "stack_game_high_scores"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      toggle_reel_interaction: {
        Args: { p_reel_id: string; p_type: string; p_user_id: string }
        Returns: boolean
      }
      trigger_badge_calculation: { Args: never; Returns: undefined }
      update_crossy_road_high_score: {
        Args: { p_score: number; p_steps: number }
        Returns: undefined
      }
      update_knife_rain_high_score: {
        Args: { p_score: number; p_stage?: number }
        Returns: undefined
      }
      update_stack_high_score: { Args: { p_score: number }; Returns: undefined }
      update_user_last_active: { Args: never; Returns: undefined }
      use_card_discount:
        | {
            Args: {
              p_card_id: string
              p_category_id: string
              p_order_id?: string
              p_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_category_id: string
              p_order_id?: string
              p_user_id: string
            }
            Returns: Json
          }
      use_vip_free_play: {
        Args: { p_game_type: string; p_user_id: string }
        Returns: boolean
      }
      validate_coupon: { Args: { coupon_code: string }; Returns: Json }
      validate_coupon_with_rate_limit: {
        Args: { coupon_code: string }
        Returns: Json
      }
      verify_printer_serial: {
        Args: { p_serial_number: string }
        Returns: {
          id: string
          is_available: boolean
          model_name: string
          model_name_ar: string
        }[]
      }
      verify_wallet_pin: { Args: { pin_code: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "manager" | "worker" | "assistant"
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
      price_protection_status:
        | "pending"
        | "awaiting_admin"
        | "processed"
        | "rejected"
      print_offer_status:
        | "submitted"
        | "withdrawn"
        | "accepted"
        | "rejected"
        | "completed"
      print_rating_role: "customer" | "merchant"
      print_request_status:
        | "pending_review"
        | "approved"
        | "rejected"
        | "in_progress"
        | "completed"
        | "delivered"
        | "cancelled"
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
      app_role: ["admin", "user", "manager", "worker", "assistant"],
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
      price_protection_status: [
        "pending",
        "awaiting_admin",
        "processed",
        "rejected",
      ],
      print_offer_status: [
        "submitted",
        "withdrawn",
        "accepted",
        "rejected",
        "completed",
      ],
      print_rating_role: ["customer", "merchant"],
      print_request_status: [
        "pending_review",
        "approved",
        "rejected",
        "in_progress",
        "completed",
        "delivered",
        "cancelled",
      ],
      printer_subscription_status: ["active", "paused", "expired", "cancelled"],
      printer_verification_status: ["pending", "verified", "rejected"],
      protection_plan_type: ["basic", "standard", "comprehensive"],
    },
  },
} as const
