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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          metadata: Json
          path: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          metadata?: Json
          path?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          metadata?: Json
          path?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          id: string
          published: boolean | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          published?: boolean | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          published?: boolean | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cart: {
        Row: {
          created_at: string | null
          id: string
          last_reminded_at: string | null
          product_id: string
          quantity: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_reminded_at?: string | null
          product_id: string
          quantity?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_reminded_at?: string | null
          product_id?: string
          quantity?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          display_order: number
          icon: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount_amount: number | null
          min_order_amount: number | null
          updated_at: string
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          min_order_amount?: number | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          min_order_amount?: number | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: []
      }
      draw_entries: {
        Row: {
          created_at: string
          draw_id: string
          entry_type: string
          id: string
          is_paid: boolean
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          draw_id: string
          entry_type?: string
          id?: string
          is_paid?: boolean
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          draw_id?: string
          entry_type?: string
          id?: string
          is_paid?: boolean
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draw_entries_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "draws"
            referencedColumns: ["id"]
          },
        ]
      }
      draw_prizes: {
        Row: {
          created_at: string
          draw_id: string
          id: string
          position: number
          prize_amount: number
          prize_label: string
          winner_user_id: string | null
        }
        Insert: {
          created_at?: string
          draw_id: string
          id?: string
          position: number
          prize_amount: number
          prize_label: string
          winner_user_id?: string | null
        }
        Update: {
          created_at?: string
          draw_id?: string
          id?: string
          position?: number
          prize_amount?: number
          prize_label?: string
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draw_prizes_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "draws"
            referencedColumns: ["id"]
          },
        ]
      }
      draw_winners: {
        Row: {
          created_at: string
          draw_id: string
          id: string
          prize_amount: number
          prize_label: string
          prize_position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          draw_id: string
          id?: string
          prize_amount: number
          prize_label: string
          prize_position: number
          user_id: string
        }
        Update: {
          created_at?: string
          draw_id?: string
          id?: string
          prize_amount?: number
          prize_label?: string
          prize_position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draw_winners_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "draws"
            referencedColumns: ["id"]
          },
        ]
      }
      draws: {
        Row: {
          created_at: string
          description: string | null
          draw_date: string
          draw_hash: string | null
          draw_seed: string | null
          entry_fee: number
          free_entries_per_user: number
          id: string
          max_entries_per_user: number | null
          status: Database["public"]["Enums"]["draw_status"]
          title: string
          total_prize_pool: number
          updated_at: string
          winner_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          draw_date: string
          draw_hash?: string | null
          draw_seed?: string | null
          entry_fee?: number
          free_entries_per_user?: number
          id?: string
          max_entries_per_user?: number | null
          status?: Database["public"]["Enums"]["draw_status"]
          title: string
          total_prize_pool?: number
          updated_at?: string
          winner_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          draw_date?: string
          draw_hash?: string | null
          draw_seed?: string | null
          entry_fee?: number
          free_entries_per_user?: number
          id?: string
          max_entries_per_user?: number | null
          status?: Database["public"]["Enums"]["draw_status"]
          title?: string
          total_prize_pool?: number
          updated_at?: string
          winner_count?: number
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          body_html: string
          created_at: string
          created_by: string | null
          failed_count: number
          id: string
          sent_at: string | null
          sent_count: number
          status: string
          subject: string
        }
        Insert: {
          body_html: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject: string
        }
        Update: {
          body_html?: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: string
        }
        Relationships: []
      }
      loyalty_redemptions: {
        Row: {
          created_at: string
          credit_amount: number
          id: string
          points_used: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_amount: number
          id?: string
          points_used: number
          user_id: string
        }
        Update: {
          created_at?: string
          credit_amount?: number
          id?: string
          points_used?: number
          user_id?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          is_active: boolean
          subscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          is_active?: boolean
          subscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          is_active?: boolean
          subscribed_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_price?: number
          quantity?: number
          subtotal?: number
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
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_status: string
          old_status: string | null
          order_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: string
          old_status?: string | null
          order_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: string
          old_status?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          city: string
          coupon_code: string | null
          created_at: string | null
          discount_amount: number | null
          estimated_delivery_date: string | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          payment_id: string | null
          payment_status: string | null
          shipping_address: string
          shipping_fee: number | null
          state: string
          status: Database["public"]["Enums"]["order_status"] | null
          tax_amount: number | null
          total_amount: number
          tracking_number: string | null
          updated_at: string | null
          user_id: string | null
          zip_code: string
        }
        Insert: {
          city: string
          coupon_code?: string | null
          created_at?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          payment_id?: string | null
          payment_status?: string | null
          shipping_address: string
          shipping_fee?: number | null
          state: string
          status?: Database["public"]["Enums"]["order_status"] | null
          tax_amount?: number | null
          total_amount: number
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code: string
        }
        Update: {
          city?: string
          coupon_code?: string | null
          created_at?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          payment_id?: string | null
          payment_status?: string | null
          shipping_address?: string
          shipping_fee?: number | null
          state?: string
          status?: Database["public"]["Enums"]["order_status"] | null
          tax_amount?: number | null
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          display_order: number
          id: string
          image_url: string
          product_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          product_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          asker_name: string
          created_at: string
          id: string
          is_published: boolean
          product_id: string
          question: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          asker_name?: string
          created_at?: string
          id?: string
          is_published?: boolean
          product_id: string
          question: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          asker_name?: string
          created_at?: string
          id?: string
          is_published?: boolean
          product_id?: string
          question?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_returns: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          order_id: string | null
          processed_at: string | null
          product_id: string | null
          product_name: string
          quantity: number
          reason: string | null
          refund_amount: number
          restocking_cost: number
          return_shipping_cost: number
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          processed_at?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          reason?: string | null
          refund_amount?: number
          restocking_cost?: number
          return_shipping_cost?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          processed_at?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          reason?: string | null
          refund_amount?: number
          restocking_cost?: number
          return_shipping_cost?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          reviewer_name: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          reviewer_name: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          reviewer_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          price_adjustment: number
          product_id: string
          stock: number
          variant_type: string
          variant_value: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_adjustment?: number
          product_id: string
          stock?: number
          variant_type: string
          variant_value: string
        }
        Update: {
          created_at?: string
          id?: string
          price_adjustment?: number
          product_id?: string
          stock?: number
          variant_type?: string
          variant_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          id: string
          image_url: string | null
          name: string
          price: number
          stock: number | null
          subcategory_id: string | null
          updated_at: string | null
          volume_tiers: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          stock?: number | null
          subcategory_id?: string | null
          updated_at?: string | null
          volume_tiers?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          stock?: number | null
          subcategory_id?: string | null
          updated_at?: string | null
          volume_tiers?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          state: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      quiz_answer_locks: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          quiz_id: string
          selected_option: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          quiz_id: string
          selected_option: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          quiz_id?: string
          selected_option?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answer_locks_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answer_locks_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          prize_amount: number
          prize_won: boolean
          questions_answered: Json
          quiz_id: string
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          prize_amount?: number
          prize_won?: boolean
          questions_answered?: Json
          quiz_id: string
          score?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          prize_amount?: number
          prize_won?: boolean
          questions_answered?: Json
          quiz_id?: string
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_option: number
          created_at: string
          id: string
          options: Json
          question: string
          quiz_id: string
        }
        Insert: {
          correct_option?: number
          created_at?: string
          id?: string
          options?: Json
          question: string
          quiz_id: string
        }
        Update: {
          correct_option?: number
          created_at?: string
          id?: string
          options?: Json
          question?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          passing_score: number
          prize_amount: number
          prize_description: string | null
          questions_per_attempt: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          passing_score?: number
          prize_amount?: number
          prize_description?: string | null
          questions_per_attempt?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          passing_score?: number
          prize_amount?: number
          prize_description?: string | null
          questions_per_attempt?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          total_referrals: number
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          total_referrals?: number
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          total_referrals?: number
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_entries_awarded: number
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          bonus_entries_awarded?: number
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          bonus_entries_awarded?: number
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      saved_addresses: {
        Row: {
          address: string
          city: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          phone: string
          recipient_name: string
          state: string
          updated_at: string
          user_id: string
          zip_code: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          phone: string
          recipient_name: string
          state: string
          updated_at?: string
          user_id: string
          zip_code: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          phone?: string
          recipient_name?: string
          state?: string
          updated_at?: string
          user_id?: string
          zip_code?: string
        }
        Relationships: []
      }
      stock_notifications: {
        Row: {
          created_at: string
          email: string
          id: string
          notified: boolean
          product_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notified?: boolean
          product_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notified?: boolean
          product_id?: string
          user_id?: string | null
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
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          display_order: number
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          display_order?: number
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          status: string
          type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: string
          type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: string
          type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_deposited: number
          total_spent: number
          total_withdrawn: number
          total_won: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_deposited?: number
          total_spent?: number
          total_withdrawn?: number
          total_won?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_deposited?: number
          total_spent?: number
          total_withdrawn?: number
          total_won?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wishlist: {
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
            foreignKeyName: "wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          processed_at: string | null
          status: string
          upi_id: string | null
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          upi_id?: string | null
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          upi_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_quiz_questions: {
        Args: { p_quiz_id: string }
        Returns: {
          correct_option: number
          created_at: string
          id: string
          options: Json
          question: string
          quiz_id: string
        }[]
      }
      admin_sales_analytics: { Args: { p_days?: number }; Returns: Json }
      admin_traffic_analytics: { Args: { p_days?: number }; Returns: Json }
      admin_user_analytics: {
        Args: { p_days?: number; p_limit?: number }
        Returns: Json
      }
      execute_draw: { Args: { p_draw_id: string }; Returns: undefined }
      grade_quiz_answer: {
        Args: { p_question_id: string; p_selected_option: number }
        Returns: {
          correct_option: number
          is_correct: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer"
      draw_status: "upcoming" | "active" | "drawing" | "completed" | "cancelled"
      order_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "customer"],
      draw_status: ["upcoming", "active", "drawing", "completed", "cancelled"],
      order_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const
