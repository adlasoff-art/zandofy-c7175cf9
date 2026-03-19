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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string
        }
        Relationships: []
      }
      affiliate_tiers: {
        Row: {
          badge_label: string
          bonus_points: number
          commission_pct: number
          created_at: string
          id: string
          min_referrals: number
          tier_name: string
        }
        Insert: {
          badge_label?: string
          bonus_points?: number
          commission_pct?: number
          created_at?: string
          id?: string
          min_referrals?: number
          tier_name: string
        }
        Update: {
          badge_label?: string
          bonus_points?: number
          commission_pct?: number
          created_at?: string
          id?: string
          min_referrals?: number
          tier_name?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          duration_seconds: number | null
          event_type: string
          id: string
          is_pwa: boolean | null
          metadata: Json | null
          os: string | null
          page_path: string | null
          product_id: string | null
          referrer: string | null
          screen_height: number | null
          screen_width: number | null
          session_id: string
          store_id: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          event_type: string
          id?: string
          is_pwa?: boolean | null
          metadata?: Json | null
          os?: string | null
          page_path?: string | null
          product_id?: string | null
          referrer?: string | null
          screen_height?: number | null
          screen_width?: number | null
          session_id: string
          store_id?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          event_type?: string
          id?: string
          is_pwa?: boolean | null
          metadata?: Json | null
          os?: string | null
          page_path?: string | null
          product_id?: string | null
          referrer?: string | null
          screen_height?: number | null
          screen_width?: number | null
          session_id?: string
          store_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      badge_requests: {
        Row: {
          created_at: string
          id: string
          requested_tier: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          requested_tier: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          requested_tier?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      blog_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_approved: boolean | null
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_approved?: boolean | null
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_approved?: boolean | null
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blog_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_editors: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          is_active: boolean | null
          permissions: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          permissions?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          permissions?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      blog_post_views: {
        Row: {
          created_at: string
          id: string
          ip_hash: string | null
          post_id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          post_id: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          post_id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          canonical_url: string | null
          category_id: string | null
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          featured: boolean | null
          id: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          published_at: string | null
          reading_time_min: number | null
          schema_type: string | null
          seo_keywords: string[] | null
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          video_embeds: Json | null
          views_count: number | null
        }
        Insert: {
          author_id: string
          canonical_url?: string | null
          category_id?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          reading_time_min?: number | null
          schema_type?: string | null
          seo_keywords?: string[] | null
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          video_embeds?: Json | null
          views_count?: number | null
        }
        Update: {
          author_id?: string
          canonical_url?: string | null
          category_id?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          reading_time_min?: number | null
          schema_type?: string | null
          seo_keywords?: string[] | null
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          video_embeds?: Json | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          justification: string | null
          order_id: string
          reason: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          justification?: string | null
          order_id: string
          reason?: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          justification?: string | null
          order_id?: string
          reason?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          color: string | null
          created_at: string
          id: string
          product_id: string
          quantity: number
          size: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          size?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          size?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
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
          display_mode: string
          icon: string | null
          id: string
          image_url: string | null
          name: string
          name_fr: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          display_mode?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          name_fr: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          display_mode?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          name_fr?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_surcharges: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          surcharge_type: string
          surcharge_value: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          surcharge_type?: string
          surcharge_value?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          surcharge_type?: string
          surcharge_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_surcharges_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          country_code: string
          created_at: string
          id: string
          latitude: number
          logistic_zone_id: string | null
          longitude: number
          name: string
          population: number | null
          zone_id: string | null
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          latitude: number
          logistic_zone_id?: string | null
          longitude: number
          name: string
          population?: number | null
          zone_id?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          latitude?: number
          logistic_zone_id?: string | null
          longitude?: number
          name?: string
          population?: number | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cities_logistic_zone_id_fkey"
            columns: ["logistic_zone_id"]
            isOneToOne: false
            referencedRelation: "logistic_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_banners: {
        Row: {
          bg_color: string | null
          created_at: string
          cta: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link: string | null
          position: string
          sort_order: number
          subtitle: string | null
          target_page: string
          text_color: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bg_color?: string | null
          created_at?: string
          cta?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link?: string | null
          position?: string
          sort_order?: number
          subtitle?: string | null
          target_page?: string
          text_color?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bg_color?: string | null
          created_at?: string
          cta?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link?: string | null
          position?: string
          sort_order?: number
          subtitle?: string | null
          target_page?: string
          text_color?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_homepage_sections: {
        Row: {
          config: Json
          id: string
          is_active: boolean
          label: string
          section_key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          config?: Json
          id?: string
          is_active?: boolean
          label: string
          section_key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          id?: string
          is_active?: boolean
          label?: string
          section_key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      cms_menu_items: {
        Row: {
          created_at: string
          has_mega: boolean
          highlight: boolean
          icon: string | null
          id: string
          is_visible: boolean
          label: string
          menu_group: string
          open_in_new_tab: boolean
          parent_id: string | null
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          has_mega?: boolean
          highlight?: boolean
          icon?: string | null
          id?: string
          is_visible?: boolean
          label: string
          menu_group?: string
          open_in_new_tab?: boolean
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Update: {
          created_at?: string
          has_mega?: boolean
          highlight?: boolean
          icon?: string | null
          id?: string
          is_visible?: boolean
          label?: string
          menu_group?: string
          open_in_new_tab?: boolean
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cms_menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_pages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_popups: {
        Row: {
          content: string
          created_at: string
          display_frequency: string
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link: string | null
          link_label: string | null
          start_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          display_frequency?: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link?: string | null
          link_label?: string | null
          start_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          display_frequency?: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link?: string | null
          link_label?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          is_starred: boolean
          product_id: string | null
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_starred?: boolean
          product_id?: string | null
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_starred?: boolean
          product_id?: string | null
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_amount: number | null
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
        }
        Relationships: []
      }
      customer_locations: {
        Row: {
          id: string
          latitude: number
          longitude: number
          order_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          latitude?: number
          longitude?: number
          order_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          latitude?: number
          longitude?: number
          order_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tiers: {
        Row: {
          badge_label: string
          created_at: string
          discount_pct: number
          id: string
          min_orders: number
          min_spent: number
          sort_order: number
          tier_name: string
          updated_at: string
        }
        Insert: {
          badge_label: string
          created_at?: string
          discount_pct?: number
          id?: string
          min_orders: number
          min_spent: number
          sort_order?: number
          tier_name: string
          updated_at?: string
        }
        Update: {
          badge_label?: string
          created_at?: string
          discount_pct?: number
          id?: string
          min_orders?: number
          min_spent?: number
          sort_order?: number
          tier_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          address: string
          amount: number
          created_at: string
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          delivery_date: string
          delivery_lat: number | null
          delivery_lng: number | null
          id: string
          items_count: number
          notes: string | null
          order_id: string | null
          order_ref: string | null
          proof_photo_url: string | null
          rider_id: string
          signature_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address: string
          amount?: number
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_date?: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          id?: string
          items_count?: number
          notes?: string | null
          order_id?: string | null
          order_ref?: string | null
          proof_photo_url?: string | null
          rider_id: string
          signature_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          amount?: number
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_date?: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          id?: string
          items_count?: number
          notes?: string | null
          order_id?: string | null
          order_ref?: string | null
          proof_photo_url?: string | null
          rider_id?: string
          signature_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_messages: {
        Row: {
          content: string
          created_at: string
          dispute_id: string
          id: string
          sender_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          dispute_id: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          dispute_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_id: string
          priority: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          return_request_id: string | null
          status: string
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_id: string
          priority?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          return_request_id?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string
          priority?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          return_request_id?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_return_request_id_fkey"
            columns: ["return_request_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          base_currency: string
          id: string
          rate: number
          target_currency: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          id?: string
          rate?: number
          target_currency: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          id?: string
          rate?: number
          target_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
      featured_placement_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          desired_duration_days: number | null
          desired_end_date: string | null
          desired_start_date: string | null
          id: string
          image_url: string | null
          message: string | null
          price_quoted: number | null
          product_ids: string[]
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          desired_duration_days?: number | null
          desired_end_date?: string | null
          desired_start_date?: string | null
          id?: string
          image_url?: string | null
          message?: string | null
          price_quoted?: number | null
          product_ids?: string[]
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          desired_duration_days?: number | null
          desired_end_date?: string | null
          desired_start_date?: string | null
          id?: string
          image_url?: string | null
          message?: string | null
          price_quoted?: number | null
          product_ids?: string[]
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_placement_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_placements: {
        Row: {
          bg_color: string | null
          created_at: string
          created_by: string | null
          cta_link: string | null
          cta_text: string | null
          end_date: string
          id: string
          image_url: string | null
          is_active: boolean
          placement_type: string
          price_charged: number | null
          product_id: string | null
          show_timer: boolean
          sort_order: number
          start_date: string
          store_id: string | null
          text_color: string | null
          timer_color: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          bg_color?: string | null
          created_at?: string
          created_by?: string | null
          cta_link?: string | null
          cta_text?: string | null
          end_date: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          placement_type?: string
          price_charged?: number | null
          product_id?: string | null
          show_timer?: boolean
          sort_order?: number
          start_date?: string
          store_id?: string | null
          text_color?: string | null
          timer_color?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          bg_color?: string | null
          created_at?: string
          created_by?: string | null
          cta_link?: string | null
          cta_text?: string | null
          end_date?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          placement_type?: string
          price_charged?: number | null
          product_id?: string | null
          show_timer?: boolean
          sort_order?: number
          start_date?: string
          store_id?: string | null
          text_color?: string | null
          timer_color?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_placements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_placements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          original_amount: number
          points_used: number
          remaining_amount: number
          status: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          original_amount?: number
          points_used?: number
          remaining_amount?: number
          status?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          original_amount?: number
          points_used?: number
          remaining_amount?: number
          status?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          contract_type: string
          created_at: string
          created_by: string | null
          deadline: string | null
          department: string
          description: string
          education_level: string
          experience_years: string
          id: string
          is_active: boolean
          location: string
          posting_type: string
          requirements: string[]
          salary_range: string | null
          skills: string[]
          title: string
          updated_at: string
        }
        Insert: {
          contract_type?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department?: string
          description?: string
          education_level?: string
          experience_years?: string
          id?: string
          is_active?: boolean
          location?: string
          posting_type?: string
          requirements?: string[]
          salary_range?: string | null
          skills?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          contract_type?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department?: string
          description?: string
          education_level?: string
          experience_years?: string
          id?: string
          is_active?: boolean
          location?: string
          posting_type?: string
          requirements?: string[]
          salary_range?: string | null
          skills?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      kyc_audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          kyc_id: string
          new_status: Database["public"]["Enums"]["kyc_status"] | null
          notes: string | null
          old_status: Database["public"]["Enums"]["kyc_status"] | null
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          kyc_id: string
          new_status?: Database["public"]["Enums"]["kyc_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["kyc_status"] | null
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          kyc_id?: string
          new_status?: Database["public"]["Enums"]["kyc_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["kyc_status"] | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_audit_logs_kyc_id_fkey"
            columns: ["kyc_id"]
            isOneToOne: false
            referencedRelation: "kyc_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_verifications: {
        Row: {
          address_city: string
          address_country: string
          address_district: string | null
          address_postal_code: string | null
          address_street: string
          admin_notes: string | null
          created_at: string
          document_back_url: string | null
          document_front_url: string
          document_type: Database["public"]["Enums"]["kyc_document_type"]
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address_city: string
          address_country?: string
          address_district?: string | null
          address_postal_code?: string | null
          address_street: string
          admin_notes?: string | null
          created_at?: string
          document_back_url?: string | null
          document_front_url: string
          document_type: Database["public"]["Enums"]["kyc_document_type"]
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url: string
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address_city?: string
          address_country?: string
          address_district?: string | null
          address_postal_code?: string | null
          address_street?: string
          admin_notes?: string | null
          created_at?: string
          document_back_url?: string | null
          document_front_url?: string
          document_type?: Database["public"]["Enums"]["kyc_document_type"]
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      logistic_zones: {
        Row: {
          continent: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          continent: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          continent?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
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
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          color: string | null
          created_at: string
          id: string
          order_id: string
          price: number
          product_id: string | null
          product_image: string | null
          product_name: string
          quantity: number
          size: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          order_id: string
          price: number
          product_id?: string | null
          product_image?: string | null
          product_name: string
          quantity?: number
          size?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          order_id?: string
          price?: number
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          quantity?: number
          size?: string | null
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
          changed_by: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          status?: string
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
          assigned_rider_id: string | null
          assigned_rider_name: string | null
          confirmation_code: string | null
          coupon_code: string | null
          created_at: string
          deferred_payment_phone: string | null
          deferred_payment_provider: string | null
          delivery_choice: string | null
          discount_amount: number | null
          hub_pickup_proof_url: string | null
          id: string
          last_mile_fee: number | null
          last_mile_payment_method: string | null
          last_mile_payment_proof_url: string | null
          last_mile_payment_status: string | null
          order_ref: string
          payment_method: string | null
          rider_cash_collected: boolean | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_cost: number
          shipping_country: string | null
          shipping_email: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_payment_proof_url: string | null
          shipping_payment_status: string | null
          shipping_phone: string | null
          shipping_postal_code: string | null
          status: string
          store_id: string | null
          subtotal: number
          supplier_order_number: string | null
          total: number
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_rider_id?: string | null
          assigned_rider_name?: string | null
          confirmation_code?: string | null
          coupon_code?: string | null
          created_at?: string
          deferred_payment_phone?: string | null
          deferred_payment_provider?: string | null
          delivery_choice?: string | null
          discount_amount?: number | null
          hub_pickup_proof_url?: string | null
          id?: string
          last_mile_fee?: number | null
          last_mile_payment_method?: string | null
          last_mile_payment_proof_url?: string | null
          last_mile_payment_status?: string | null
          order_ref: string
          payment_method?: string | null
          rider_cash_collected?: boolean | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_cost?: number
          shipping_country?: string | null
          shipping_email?: string | null
          shipping_first_name?: string | null
          shipping_last_name?: string | null
          shipping_payment_proof_url?: string | null
          shipping_payment_status?: string | null
          shipping_phone?: string | null
          shipping_postal_code?: string | null
          status?: string
          store_id?: string | null
          subtotal?: number
          supplier_order_number?: string | null
          total?: number
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_rider_id?: string | null
          assigned_rider_name?: string | null
          confirmation_code?: string | null
          coupon_code?: string | null
          created_at?: string
          deferred_payment_phone?: string | null
          deferred_payment_provider?: string | null
          delivery_choice?: string | null
          discount_amount?: number | null
          hub_pickup_proof_url?: string | null
          id?: string
          last_mile_fee?: number | null
          last_mile_payment_method?: string | null
          last_mile_payment_proof_url?: string | null
          last_mile_payment_status?: string | null
          order_ref?: string
          payment_method?: string | null
          rider_cash_collected?: boolean | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_cost?: number
          shipping_country?: string | null
          shipping_email?: string | null
          shipping_first_name?: string | null
          shipping_last_name?: string | null
          shipping_payment_proof_url?: string | null
          shipping_payment_status?: string | null
          shipping_phone?: string | null
          shipping_postal_code?: string | null
          status?: string
          store_id?: string | null
          subtotal?: number
          supplier_order_number?: string | null
          total?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          callback_payload: Json | null
          created_at: string
          currency: string
          id: string
          method: string
          order_id: string
          phone_number: string | null
          provider: string | null
          reference: string
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          callback_payload?: Json | null
          created_at?: string
          currency?: string
          id?: string
          method?: string
          order_id: string
          phone_number?: string | null
          provider?: string | null
          reference: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          callback_payload?: Json | null
          created_at?: string
          currency?: string
          id?: string
          method?: string
          order_id?: string
          phone_number?: string | null
          provider?: string | null
          reference?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          referral_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          referral_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          referral_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      product_colors: {
        Row: {
          color_hex: string
          color_name: string
          id: string
          image_url: string | null
          product_id: string
        }
        Insert: {
          color_hex: string
          color_name: string
          id?: string
          image_url?: string | null
          product_id: string
        }
        Update: {
          color_hex?: string
          color_name?: string
          id?: string
          image_url?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_colors_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          id: string
          image_url: string
          position: number | null
          product_id: string
        }
        Insert: {
          id?: string
          image_url: string
          position?: number | null
          product_id: string
        }
        Update: {
          id?: string
          image_url?: string
          position?: number | null
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
      product_pricing_tiers: {
        Row: {
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          min_quantity: number
          product_id: string
          tier_label: string
        }
        Insert: {
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          min_quantity: number
          product_id: string
          tier_label: string
        }
        Update: {
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          min_quantity?: number
          product_id?: string
          tier_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sizes: {
        Row: {
          bust_cm: number | null
          hips_cm: number | null
          id: string
          product_id: string
          region: string | null
          size_label: string
          waist_cm: number | null
        }
        Insert: {
          bust_cm?: number | null
          hips_cm?: number | null
          id?: string
          product_id: string
          region?: string | null
          size_label: string
          waist_cm?: number | null
        }
        Update: {
          bust_cm?: number | null
          hips_cm?: number | null
          id?: string
          product_id?: string
          region?: string | null
          size_label?: string
          waist_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_selections: {
        Row: {
          created_at: string
          id: string
          product_id: string
          variant_option_id: string
          variant_type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          variant_option_id: string
          variant_type_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          variant_option_id?: string
          variant_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_selections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_selections_variant_option_id_fkey"
            columns: ["variant_option_id"]
            isOneToOne: false
            referencedRelation: "variant_type_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_selections_variant_type_id_fkey"
            columns: ["variant_type_id"]
            isOneToOne: false
            referencedRelation: "variant_types"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          discount: number | null
          flash_timer_duration_hours: number | null
          flash_timer_enabled: boolean | null
          height_cm: number | null
          id: string
          is_new: boolean | null
          is_sale: boolean | null
          length_cm: number | null
          material: string | null
          meta_description: string | null
          meta_title: string | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          moderation_reason_link: string | null
          moq: number | null
          name: string
          name_fr: string
          origin_country: string | null
          original_price: number | null
          price: number
          promo_end_date: string | null
          promo_start_date: string | null
          publish_status: string
          rating: number | null
          review_count: number | null
          review_count_override: number | null
          sales_count_override: number | null
          seo_keywords: string[] | null
          short_description: string | null
          sku: string | null
          slug: string
          stock_quantity: number | null
          store_id: string | null
          style: string | null
          updated_at: string
          verified_years: number | null
          verified_years_override: number | null
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          discount?: number | null
          flash_timer_duration_hours?: number | null
          flash_timer_enabled?: boolean | null
          height_cm?: number | null
          id?: string
          is_new?: boolean | null
          is_sale?: boolean | null
          length_cm?: number | null
          material?: string | null
          meta_description?: string | null
          meta_title?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_reason_link?: string | null
          moq?: number | null
          name: string
          name_fr: string
          origin_country?: string | null
          original_price?: number | null
          price: number
          promo_end_date?: string | null
          promo_start_date?: string | null
          publish_status?: string
          rating?: number | null
          review_count?: number | null
          review_count_override?: number | null
          sales_count_override?: number | null
          seo_keywords?: string[] | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock_quantity?: number | null
          store_id?: string | null
          style?: string | null
          updated_at?: string
          verified_years?: number | null
          verified_years_override?: number | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          discount?: number | null
          flash_timer_duration_hours?: number | null
          flash_timer_enabled?: boolean | null
          height_cm?: number | null
          id?: string
          is_new?: boolean | null
          is_sale?: boolean | null
          length_cm?: number | null
          material?: string | null
          meta_description?: string | null
          meta_title?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_reason_link?: string | null
          moq?: number | null
          name?: string
          name_fr?: string
          origin_country?: string | null
          original_price?: number | null
          price?: number
          promo_end_date?: string | null
          promo_start_date?: string | null
          publish_status?: string
          rating?: number | null
          review_count?: number | null
          review_count_override?: number | null
          sales_count_override?: number | null
          seo_keywords?: string[] | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock_quantity?: number | null
          store_id?: string | null
          style?: string | null
          updated_at?: string
          verified_years?: number | null
          verified_years_override?: number | null
          weight_grams?: number | null
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
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          affiliate_tier: string | null
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          banned_by: string | null
          created_at: string
          customer_tier: string
          date_of_birth: string | null
          email: string | null
          first_name: string | null
          gender: string | null
          id: string
          is_banned: boolean
          last_name: string | null
          phone: string | null
          referral_code: string | null
          updated_at: string
        }
        Insert: {
          affiliate_tier?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          created_at?: string
          customer_tier?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id: string
          is_banned?: boolean
          last_name?: string | null
          phone?: string | null
          referral_code?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_tier?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          created_at?: string
          customer_tier?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          is_banned?: boolean
          last_name?: string | null
          phone?: string | null
          referral_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          commission_pct: number
          created_at: string
          id: string
          max_rewarded_orders: number
          referee_id: string
          referrer_id: string
          rewarded_orders_count: number
          status: string
        }
        Insert: {
          commission_pct?: number
          created_at?: string
          id?: string
          max_rewarded_orders?: number
          referee_id: string
          referrer_id: string
          rewarded_orders_count?: number
          status?: string
        }
        Update: {
          commission_pct?: number
          created_at?: string
          id?: string
          max_rewarded_orders?: number
          referee_id?: string
          referrer_id?: string
          rewarded_orders_count?: number
          status?: string
        }
        Relationships: []
      }
      return_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          id: string
          order_id: string
          reason: string
          refund_amount: number
          refund_method: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_id: string
          reason?: string
          refund_amount?: number
          refund_method?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string
          reason?: string
          refund_amount?: number
          refund_method?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string
          created_at: string
          helpful_count: number
          id: string
          images: string[] | null
          is_verified_purchase: boolean
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          helpful_count?: number
          id?: string
          images?: string[] | null
          is_verified_purchase?: boolean
          product_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          helpful_count?: number
          id?: string
          images?: string[] | null
          is_verified_purchase?: boolean
          product_id?: string
          rating?: number
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
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_locations: {
        Row: {
          delivery_id: string | null
          heading: number | null
          id: string
          latitude: number
          longitude: number
          rider_id: string
          speed: number | null
          updated_at: string
        }
        Insert: {
          delivery_id?: string | null
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          rider_id: string
          speed?: number | null
          updated_at?: string
        }
        Update: {
          delivery_id?: string | null
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          rider_id?: string
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_locations_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_addresses: {
        Row: {
          address: string
          city: string
          country: string
          created_at: string
          first_name: string
          id: string
          is_default: boolean
          label: string
          last_name: string
          phone: string
          postal_code: string | null
          user_id: string
        }
        Insert: {
          address: string
          city: string
          country?: string
          created_at?: string
          first_name: string
          id?: string
          is_default?: boolean
          label?: string
          last_name: string
          phone: string
          postal_code?: string | null
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          country?: string
          created_at?: string
          first_name?: string
          id?: string
          is_default?: boolean
          label?: string
          last_name?: string
          phone?: string
          postal_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          awb_bl: string
          created_at: string
          destination: string
          eta: string | null
          id: string
          items_count: number
          mode: string
          origin: string
          shipper_id: string
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          awb_bl: string
          created_at?: string
          destination: string
          eta?: string | null
          id?: string
          items_count?: number
          mode?: string
          origin: string
          shipper_id: string
          status?: string
          updated_at?: string
          value?: number
        }
        Update: {
          awb_bl?: string
          created_at?: string
          destination?: string
          eta?: string | null
          id?: string
          items_count?: number
          mode?: string
          origin?: string
          shipper_id?: string
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      shipping_defaults: {
        Row: {
          currency: string
          default_rate: number
          id: string
          label: string | null
          mode: string
          origin_country: string | null
          rate_unit: string
          updated_at: string
        }
        Insert: {
          currency?: string
          default_rate?: number
          id?: string
          label?: string | null
          mode: string
          origin_country?: string | null
          rate_unit?: string
          updated_at?: string
        }
        Update: {
          currency?: string
          default_rate?: number
          id?: string
          label?: string | null
          mode?: string
          origin_country?: string | null
          rate_unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipping_routes: {
        Row: {
          created_at: string
          destination_zone_id: string
          fuel_surcharge_pct: number
          id: string
          is_active: boolean
          min_charge: number
          notes: string | null
          origin_zone_id: string
          rate_price: number
          rate_unit: string
          transit_days_max: number | null
          transit_days_min: number | null
          transport_mode: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_zone_id: string
          fuel_surcharge_pct?: number
          id?: string
          is_active?: boolean
          min_charge?: number
          notes?: string | null
          origin_zone_id: string
          rate_price?: number
          rate_unit?: string
          transit_days_max?: number | null
          transit_days_min?: number | null
          transport_mode?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_zone_id?: string
          fuel_surcharge_pct?: number
          id?: string
          is_active?: boolean
          min_charge?: number
          notes?: string | null
          origin_zone_id?: string
          rate_price?: number
          rate_unit?: string
          transit_days_max?: number | null
          transit_days_min?: number | null
          transport_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_routes_destination_zone_id_fkey"
            columns: ["destination_zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_routes_origin_zone_id_fkey"
            columns: ["origin_zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string
          id: string
          name: string
          zone_type: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          name: string
          zone_type?: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          name?: string
          zone_type?: string
        }
        Relationships: []
      }
      store_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_email: string | null
          role: string
          status: string
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_email?: string | null
          role?: string
          status?: string
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_email?: string | null
          role?: string
          status?: string
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_collaborators_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_coupons: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_amount: number | null
          store_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
          store_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_reviews: {
        Row: {
          comment: string | null
          created_at: string
          helpful_count: number
          id: string
          is_verified_purchase: boolean
          order_id: string | null
          rating: number
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          helpful_count?: number
          id?: string
          is_verified_purchase?: boolean
          order_id?: string | null
          rating: number
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          helpful_count?: number
          id?: string
          is_verified_purchase?: boolean
          order_id?: string | null
          rating?: number
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          banner_url: string | null
          can_create_coupons: boolean
          chat_links_allowed: boolean
          chat_media_enabled: boolean | null
          chat_phone_allowed: boolean
          collaborators_enabled: boolean
          created_at: string
          description: string | null
          flash_timer_duration_hours: number | null
          flash_timer_enabled: boolean | null
          followers_count: number | null
          followers_override: number | null
          id: string
          is_online: boolean | null
          is_verified: boolean | null
          last_seen_at: string | null
          logo_url: string | null
          max_collaborators: number
          max_collaborators_override: number | null
          max_products_limit: number | null
          meta_description: string | null
          meta_title: string | null
          name: string
          name_change_status: string | null
          owner_id: string | null
          pending_name: string | null
          products_count: number | null
          rating: number | null
          repurchase_rate: string | null
          response_rate: string | null
          response_time: string | null
          review_count_override: number | null
          sales_count: number | null
          sales_override: number | null
          sales_trend: string | null
          seo_keywords: string[] | null
          verified_years: number | null
          verified_years_override: number | null
          whatsapp_number: string | null
        }
        Insert: {
          banner_url?: string | null
          can_create_coupons?: boolean
          chat_links_allowed?: boolean
          chat_media_enabled?: boolean | null
          chat_phone_allowed?: boolean
          collaborators_enabled?: boolean
          created_at?: string
          description?: string | null
          flash_timer_duration_hours?: number | null
          flash_timer_enabled?: boolean | null
          followers_count?: number | null
          followers_override?: number | null
          id?: string
          is_online?: boolean | null
          is_verified?: boolean | null
          last_seen_at?: string | null
          logo_url?: string | null
          max_collaborators?: number
          max_collaborators_override?: number | null
          max_products_limit?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          name_change_status?: string | null
          owner_id?: string | null
          pending_name?: string | null
          products_count?: number | null
          rating?: number | null
          repurchase_rate?: string | null
          response_rate?: string | null
          response_time?: string | null
          review_count_override?: number | null
          sales_count?: number | null
          sales_override?: number | null
          sales_trend?: string | null
          seo_keywords?: string[] | null
          verified_years?: number | null
          verified_years_override?: number | null
          whatsapp_number?: string | null
        }
        Update: {
          banner_url?: string | null
          can_create_coupons?: boolean
          chat_links_allowed?: boolean
          chat_media_enabled?: boolean | null
          chat_phone_allowed?: boolean
          collaborators_enabled?: boolean
          created_at?: string
          description?: string | null
          flash_timer_duration_hours?: number | null
          flash_timer_enabled?: boolean | null
          followers_count?: number | null
          followers_override?: number | null
          id?: string
          is_online?: boolean | null
          is_verified?: boolean | null
          last_seen_at?: string | null
          logo_url?: string | null
          max_collaborators?: number
          max_collaborators_override?: number | null
          max_products_limit?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          name_change_status?: string | null
          owner_id?: string | null
          pending_name?: string | null
          products_count?: number | null
          rating?: number | null
          repurchase_rate?: string | null
          response_rate?: string | null
          response_time?: string | null
          review_count_override?: number | null
          sales_count?: number | null
          sales_override?: number | null
          sales_trend?: string | null
          seo_keywords?: string[] | null
          verified_years?: number | null
          verified_years_override?: number | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          is_staff: boolean
          sender_email: string | null
          sender_id: string
          ticket_id: string
        }
        Insert: {
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          sender_email?: string | null
          sender_id: string
          ticket_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          sender_email?: string | null
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          id: string
          order_id: string | null
          priority: string
          requester_email: string | null
          requester_name: string | null
          requester_type: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          id?: string
          order_id?: string | null
          priority?: string
          requester_email?: string | null
          requester_name?: string | null
          requester_type?: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          id?: string
          order_id?: string | null
          priority?: string
          requester_email?: string | null
          requester_name?: string | null
          requester_type?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_warnings: {
        Row: {
          created_at: string
          id: string
          reason: string
          severity: string
          user_id: string
          warned_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          severity?: string
          user_id: string
          warned_by: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          severity?: string
          user_id?: string
          warned_by?: string
        }
        Relationships: []
      }
      variant_type_options: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number
          variant_type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          variant_type_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          variant_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_type_options_variant_type_id_fkey"
            columns: ["variant_type_id"]
            isOneToOne: false
            referencedRelation: "variant_types"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_types: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          unit: string | null
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          unit?: string | null
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          unit?: string | null
        }
        Relationships: []
      }
      vendor_applications: {
        Row: {
          admin_notes: string | null
          business_type: string | null
          company_address: string | null
          company_city: string | null
          company_country: string | null
          company_name: string | null
          created_at: string
          current_step: number
          full_name: string | null
          id: string
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          store_banner_url: string | null
          store_description: string | null
          store_logo_url: string | null
          store_name: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          business_type?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          created_at?: string
          current_step?: number
          full_name?: string | null
          id?: string
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_banner_url?: string | null
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          business_type?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          created_at?: string
          current_step?: number
          full_name?: string | null
          id?: string
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_banner_url?: string | null
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vendor_delivery_zones: {
        Row: {
          city: string
          created_at: string
          currency: string
          estimated_hours: number | null
          id: string
          is_active: boolean
          price: number
          store_id: string
          zone_name: string
        }
        Insert: {
          city: string
          created_at?: string
          currency?: string
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          price?: number
          store_id: string
          zone_name: string
        }
        Update: {
          city?: string
          created_at?: string
          currency?: string
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          price?: number
          store_id?: string
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_delivery_zones_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_documents: {
        Row: {
          admin_comment: string | null
          application_id: string
          created_at: string
          document_type: string
          document_url: string
          file_name: string | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          application_id: string
          created_at?: string
          document_type: string
          document_url: string
          file_name?: string | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          application_id?: string
          created_at?: string
          document_type?: string
          document_url?: string
          file_name?: string | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "vendor_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_subscriptions: {
        Row: {
          can_self_deliver: boolean
          created_at: string
          id: string
          is_whatsapp_enabled: boolean
          max_products: number
          paid_until: string | null
          payment_method: string | null
          store_id: string
          tier: Database["public"]["Enums"]["vendor_tier"]
          updated_at: string
        }
        Insert: {
          can_self_deliver?: boolean
          created_at?: string
          id?: string
          is_whatsapp_enabled?: boolean
          max_products?: number
          paid_until?: string | null
          payment_method?: string | null
          store_id: string
          tier?: Database["public"]["Enums"]["vendor_tier"]
          updated_at?: string
        }
        Update: {
          can_self_deliver?: boolean
          created_at?: string
          id?: string
          is_whatsapp_enabled?: boolean
          max_products?: number
          paid_until?: string | null
          payment_method?: string | null
          store_id?: string
          tier?: Database["public"]["Enums"]["vendor_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          store_id: string
          type: string
          withdrawal_request_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          store_id: string
          type?: string
          withdrawal_request_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          store_id?: string
          type?: string
          withdrawal_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_transactions_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_wallets: {
        Row: {
          available_balance: number
          created_at: string
          id: string
          min_withdrawal: number
          pending_balance: number
          retention_days: number
          store_id: string
          total_earned: number
          total_withdrawn: number
          updated_at: string
          withdrawal_frequency: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          id?: string
          min_withdrawal?: number
          pending_balance?: number
          retention_days?: number
          store_id: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          withdrawal_frequency?: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          id?: string
          min_withdrawal?: number
          pending_balance?: number
          retention_days?: number
          store_id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          withdrawal_frequency?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_wallets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
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
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          method: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          method?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          method?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      zando_points: {
        Row: {
          balance: number
          id: string
          last_activity_at: string
          pending_balance: number
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          last_activity_at?: string
          pending_balance?: number
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          last_activity_at?: string
          pending_balance?: number
          total_earned?: number
          total_spent?: number
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
      add_guest_support_message: {
        Args: {
          p_content: string
          p_requester_email: string
          p_ticket_id: string
        }
        Returns: Json
      }
      check_kyc_required: { Args: { p_user_id: string }; Returns: boolean }
      create_guest_support_ticket: {
        Args: {
          p_category: string
          p_message: string
          p_priority: string
          p_requester_email: string
          p_requester_name?: string
          p_subject: string
        }
        Returns: {
          ticket_id: string
          ticket_reference: string
        }[]
      }
      expire_inactive_points: {
        Args: { months_limit?: number }
        Returns: number
      }
      get_category_top_sellers: {
        Args: { p_category_id: string; p_limit?: number }
        Returns: {
          rank: number
          store_id: string
          store_name: string
          total_sales: number
        }[]
      }
      get_customer_loyalty_stats: {
        Args: { p_user_id: string }
        Returns: {
          total_orders: number
          total_spent: number
        }[]
      }
      get_guest_support_ticket: {
        Args: { p_requester_email: string; p_ticket_id: string }
        Returns: Json
      }
      get_product_rating_summary: {
        Args: { p_product_id: string }
        Returns: {
          avg_rating: number
          star_1: number
          star_2: number
          star_3: number
          star_4: number
          star_5: number
          total_reviews: number
        }[]
      }
      get_product_real_stats: {
        Args: { p_product_id: string }
        Returns: {
          real_avg_rating: number
          real_review_count: number
          real_sales_count: number
        }[]
      }
      get_store_followers_count: {
        Args: { p_store_id: string }
        Returns: number
      }
      get_store_sales_count: { Args: { p_store_id: string }; Returns: number }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      increment_blog_post_views: {
        Args: { p_post_id: string; p_session_id?: string }
        Returns: undefined
      }
      increment_helpful: { Args: { review_id: string }; Returns: undefined }
      is_kyc_order_blocked: { Args: { p_user_id: string }; Returns: boolean }
      is_kyc_verified: { Args: { p_user_id: string }; Returns: boolean }
      release_vendor_pending_funds: { Args: never; Returns: number }
      set_store_offline: { Args: { p_store_id: string }; Returns: undefined }
      track_delivery: {
        Args: { p_order_ref: string }
        Returns: {
          address: string
          created_at: string
          customer_name: string
          delivered_at: string
          delivery_date: string
          id: string
          status: string
          updated_at: string
        }[]
      }
      track_shipment: {
        Args: { p_awb_bl: string }
        Returns: {
          awb_bl: string
          created_at: string
          destination: string
          eta: string
          id: string
          items_count: number
          mode: string
          origin: string
          status: string
          updated_at: string
        }[]
      }
      update_store_presence: {
        Args: { p_store_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "vendor" | "shipper" | "rider"
      kyc_document_type:
        | "national_id"
        | "voter_card"
        | "passport"
        | "drivers_license"
      kyc_status:
        | "not_started"
        | "pending"
        | "approved"
        | "rejected"
        | "resubmission_required"
      product_status: "draft" | "pending_approval" | "published" | "rejected"
      vendor_tier: "beginner" | "pro" | "grand_supplier"
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
      app_role: ["admin", "manager", "vendor", "shipper", "rider"],
      kyc_document_type: [
        "national_id",
        "voter_card",
        "passport",
        "drivers_license",
      ],
      kyc_status: [
        "not_started",
        "pending",
        "approved",
        "rejected",
        "resubmission_required",
      ],
      product_status: ["draft", "pending_approval", "published", "rejected"],
      vendor_tier: ["beginner", "pro", "grand_supplier"],
    },
  },
} as const
