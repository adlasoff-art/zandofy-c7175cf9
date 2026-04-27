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
      address_change_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          new_address: string | null
          new_city: string | null
          new_commune: string | null
          new_country: string | null
          new_province: string | null
          new_province_id: string | null
          new_quartier: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          new_address?: string | null
          new_city?: string | null
          new_commune?: string | null
          new_country?: string | null
          new_province?: string | null
          new_province_id?: string | null
          new_quartier?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          new_address?: string | null
          new_city?: string | null
          new_commune?: string | null
          new_country?: string | null
          new_province?: string | null
          new_province_id?: string | null
          new_quartier?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      affiliate_links: {
        Row: {
          category_id: string | null
          clicks: number
          code: string
          conversions: number
          created_at: string
          custom_commission_pct: number | null
          id: string
          is_active: boolean
          label: string | null
          product_id: string | null
          revenue_generated: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          clicks?: number
          code: string
          conversions?: number
          created_at?: string
          custom_commission_pct?: number | null
          id?: string
          is_active?: boolean
          label?: string | null
          product_id?: string | null
          revenue_generated?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          clicks?: number
          code?: string
          conversions?: number
          created_at?: string
          custom_commission_pct?: number | null
          id?: string
          is_active?: boolean
          label?: string | null
          product_id?: string | null
          revenue_generated?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
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
      analytics_sessions: {
        Row: {
          city: string | null
          country_code: string | null
          device_type: string | null
          duration_seconds: number | null
          ended_at: string | null
          entry_page: string | null
          exit_page: string | null
          id: string
          pages_visited: string[] | null
          session_id: string
          started_at: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          entry_page?: string | null
          exit_page?: string | null
          id?: string
          pages_visited?: string[] | null
          session_id: string
          started_at?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country_code?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          entry_page?: string | null
          exit_page?: string | null
          id?: string
          pages_visited?: string[] | null
          session_id?: string
          started_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_events: {
        Row: {
          anon_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
          workflow_id: string
        }
        Insert: {
          anon_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          workflow_id: string
        }
        Update: {
          anon_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_events_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows_public"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_user_progress: {
        Row: {
          anon_id: string | null
          created_at: string
          display_count: number
          id: string
          last_displayed_at: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          user_id: string | null
          workflow_id: string
        }
        Insert: {
          anon_id?: string | null
          created_at?: string
          display_count?: number
          id?: string
          last_displayed_at?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
          workflow_id: string
        }
        Update: {
          anon_id?: string | null
          created_at?: string
          display_count?: number
          id?: string
          last_displayed_at?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_user_progress_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_user_progress_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows_public"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_workflows: {
        Row: {
          channel: Database["public"]["Enums"]["automation_channel"]
          condition_has_account: boolean | null
          condition_has_order: boolean | null
          condition_max_days_since_signup: number | null
          created_at: string
          delay_days: number
          delay_minutes: number
          display_frequency: Database["public"]["Enums"]["automation_display_frequency"]
          email_html_content: string | null
          email_subject: string | null
          id: string
          is_active: boolean
          max_displays: number | null
          name: string
          popup_content: string | null
          popup_cta_label: string | null
          popup_cta_link: string | null
          popup_image_url: string | null
          popup_title: string | null
          push_body: string | null
          push_title: string | null
          sort_order: number
          trigger_type: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["automation_channel"]
          condition_has_account?: boolean | null
          condition_has_order?: boolean | null
          condition_max_days_since_signup?: number | null
          created_at?: string
          delay_days?: number
          delay_minutes?: number
          display_frequency?: Database["public"]["Enums"]["automation_display_frequency"]
          email_html_content?: string | null
          email_subject?: string | null
          id?: string
          is_active?: boolean
          max_displays?: number | null
          name: string
          popup_content?: string | null
          popup_cta_label?: string | null
          popup_cta_link?: string | null
          popup_image_url?: string | null
          popup_title?: string | null
          push_body?: string | null
          push_title?: string | null
          sort_order?: number
          trigger_type: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["automation_channel"]
          condition_has_account?: boolean | null
          condition_has_order?: boolean | null
          condition_max_days_since_signup?: number | null
          created_at?: string
          delay_days?: number
          delay_minutes?: number
          display_frequency?: Database["public"]["Enums"]["automation_display_frequency"]
          email_html_content?: string | null
          email_subject?: string | null
          id?: string
          is_active?: boolean
          max_displays?: number | null
          name?: string
          popup_content?: string | null
          popup_cta_label?: string | null
          popup_cta_link?: string | null
          popup_image_url?: string | null
          popup_title?: string | null
          push_body?: string | null
          push_title?: string | null
          sort_order?: number
          trigger_type?: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at?: string
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
      bundle_items: {
        Row: {
          bundle_id: string
          id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          bundle_id: string
          id?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          bundle_id?: string
          id?: string
          product_id?: string
          sort_order?: number
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
            foreignKeyName: "bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_send_log: {
        Row: {
          campaign_id: string
          error_message: string | null
          id: string
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          error_message?: string | null
          id?: string
          sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          error_message?: string | null
          id?: string
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_send_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "scheduled_campaigns"
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
          {
            foreignKeyName: "cancellation_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
          selected: boolean
          size: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          selected?: boolean
          size?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          selected?: boolean
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
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
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
          sort_order: number
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
          sort_order?: number
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
          sort_order?: number
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
          is_active: boolean
          latitude: number
          logistic_zone_id: string | null
          longitude: number
          name: string
          population: number | null
          province_id: string | null
          zone_id: string | null
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude: number
          logistic_zone_id?: string | null
          longitude: number
          name: string
          population?: number | null
          province_id?: string | null
          zone_id?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number
          logistic_zone_id?: string | null
          longitude?: number
          name?: string
          population?: number | null
          province_id?: string | null
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
            foreignKeyName: "cities_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
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
      communes: {
        Row: {
          city: string
          country_code: string
          created_at: string | null
          delivery_fee_legacy_deprecated: number | null
          id: string
          is_active: boolean | null
          is_deliverable: boolean | null
          name: string
        }
        Insert: {
          city: string
          country_code?: string
          created_at?: string | null
          delivery_fee_legacy_deprecated?: number | null
          id?: string
          is_active?: boolean | null
          is_deliverable?: boolean | null
          name: string
        }
        Update: {
          city?: string
          country_code?: string
          created_at?: string | null
          delivery_fee_legacy_deprecated?: number | null
          id?: string
          is_active?: boolean | null
          is_deliverable?: boolean | null
          name?: string
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
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
          target_city: string | null
          target_country: string | null
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
          target_city?: string | null
          target_country?: string | null
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
          target_city?: string | null
          target_country?: string | null
        }
        Relationships: []
      }
      coverage_requests: {
        Row: {
          city: string
          commune: string | null
          commune_id: string | null
          country_code: string
          created_at: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          fulfilled_operator_id: string | null
          id: string
          notes: string | null
          quartier: string | null
          quartier_id: string | null
          requested_at: string
          user_id: string
        }
        Insert: {
          city: string
          commune?: string | null
          commune_id?: string | null
          country_code?: string
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfilled_operator_id?: string | null
          id?: string
          notes?: string | null
          quartier?: string | null
          quartier_id?: string | null
          requested_at?: string
          user_id: string
        }
        Update: {
          city?: string
          commune?: string | null
          commune_id?: string | null
          country_code?: string
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfilled_operator_id?: string | null
          id?: string
          notes?: string | null
          quartier?: string | null
          quartier_id?: string | null
          requested_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverage_requests_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_requests_fulfilled_operator_id_fkey"
            columns: ["fulfilled_operator_id"]
            isOneToOne: false
            referencedRelation: "delivery_operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_requests_fulfilled_operator_id_fkey"
            columns: ["fulfilled_operator_id"]
            isOneToOne: false
            referencedRelation: "v_active_operators_by_city"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "coverage_requests_fulfilled_operator_id_fkey"
            columns: ["fulfilled_operator_id"]
            isOneToOne: false
            referencedRelation: "v_operator_performance"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "coverage_requests_quartier_id_fkey"
            columns: ["quartier_id"]
            isOneToOne: false
            referencedRelation: "quartiers"
            referencedColumns: ["id"]
          },
        ]
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
      customer_ratings: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          order_id: string
          rating: number
          store_id: string
          vendor_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          order_id: string
          rating: number
          store_id: string
          vendor_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string
          rating?: number
          store_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ratings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ratings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
      delivery_chats: {
        Row: {
          created_at: string
          delivery_id: string | null
          id: string
          message: string
          order_id: string | null
          sender_id: string
        }
        Insert: {
          created_at?: string
          delivery_id?: string | null
          id?: string
          message?: string
          order_id?: string | null
          sender_id: string
        }
        Update: {
          created_at?: string
          delivery_id?: string | null
          id?: string
          message?: string
          order_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_chats_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_chats_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_operator_cities: {
        Row: {
          city: string
          commune_ids: string[]
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          operator_id: string
          province_id: string | null
          quartier_ids: string[]
        }
        Insert: {
          city: string
          commune_ids?: string[]
          country_code: string
          created_at?: string
          id?: string
          is_active?: boolean
          operator_id: string
          province_id?: string | null
          quartier_ids?: string[]
        }
        Update: {
          city?: string
          commune_ids?: string[]
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          operator_id?: string
          province_id?: string | null
          quartier_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_operator_cities_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "delivery_operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_operator_cities_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_active_operators_by_city"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "delivery_operator_cities_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_operator_performance"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "delivery_operator_cities_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_operator_city_caps: {
        Row: {
          city: string
          country_code: string
          created_at: string
          id: string
          max_base_price: number
          max_estimated_minutes: number
          max_surcharge: number
          notes: string | null
          updated_at: string
        }
        Insert: {
          city: string
          country_code: string
          created_at?: string
          id?: string
          max_base_price: number
          max_estimated_minutes?: number
          max_surcharge?: number
          notes?: string | null
          updated_at?: string
        }
        Update: {
          city?: string
          country_code?: string
          created_at?: string
          id?: string
          max_base_price?: number
          max_estimated_minutes?: number
          max_surcharge?: number
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_operator_rates: {
        Row: {
          base_price: number
          city: string
          commune: string | null
          country_code: string
          created_at: string
          currency: string
          estimated_minutes: number
          id: string
          is_active: boolean
          operator_id: string
          price_per_km: number
          quartier: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          surcharge: number
          updated_at: string
          zone_name: string
        }
        Insert: {
          base_price: number
          city: string
          commune?: string | null
          country_code: string
          created_at?: string
          currency?: string
          estimated_minutes?: number
          id?: string
          is_active?: boolean
          operator_id: string
          price_per_km?: number
          quartier?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          surcharge?: number
          updated_at?: string
          zone_name: string
        }
        Update: {
          base_price?: number
          city?: string
          commune?: string | null
          country_code?: string
          created_at?: string
          currency?: string
          estimated_minutes?: number
          id?: string
          is_active?: boolean
          operator_id?: string
          price_per_km?: number
          quartier?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          surcharge?: number
          updated_at?: string
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_operator_rates_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "delivery_operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_operator_rates_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_active_operators_by_city"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "delivery_operator_rates_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_operator_performance"
            referencedColumns: ["operator_id"]
          },
        ]
      }
      delivery_operator_riders: {
        Row: {
          activated_at: string | null
          id: string
          invited_at: string
          operator_id: string
          revoked_at: string | null
          rider_user_id: string
          status: string
          vehicle_plate: string | null
          vehicle_type: string
        }
        Insert: {
          activated_at?: string | null
          id?: string
          invited_at?: string
          operator_id: string
          revoked_at?: string | null
          rider_user_id: string
          status?: string
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Update: {
          activated_at?: string | null
          id?: string
          invited_at?: string
          operator_id?: string
          revoked_at?: string | null
          rider_user_id?: string
          status?: string
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_operator_riders_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "delivery_operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_operator_riders_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_active_operators_by_city"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "delivery_operator_riders_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_operator_performance"
            referencedColumns: ["operator_id"]
          },
        ]
      }
      delivery_operator_thresholds: {
        Row: {
          auto_suspend_enabled: boolean
          created_at: string
          id: string
          is_active: boolean
          max_decline_rate_pct: number
          max_expiry_rate_pct: number
          min_assignments: number
          min_score: number
          notes: string | null
          updated_at: string
          window_days: number
        }
        Insert: {
          auto_suspend_enabled?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          max_decline_rate_pct?: number
          max_expiry_rate_pct?: number
          min_assignments?: number
          min_score?: number
          notes?: string | null
          updated_at?: string
          window_days?: number
        }
        Update: {
          auto_suspend_enabled?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          max_decline_rate_pct?: number
          max_expiry_rate_pct?: number
          min_assignments?: number
          min_score?: number
          notes?: string | null
          updated_at?: string
          window_days?: number
        }
        Relationships: []
      }
      delivery_operators: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          auto_suspended_at: string | null
          auto_suspension_reason: string | null
          company_name: string
          contact_email: string
          contact_phone: string
          created_at: string
          declared_riders_count: number
          fleet_vehicles: Json
          headquarters_address: string | null
          headquarters_city: string
          headquarters_country: string
          id: string
          is_active: boolean
          is_platform_owned: boolean
          legal_name: string | null
          logo_url: string | null
          max_riders: number
          owner_user_id: string
          platform_commission_pct: number
          rating_avg: number | null
          registration_number: string | null
          rejection_reason: string | null
          reliability_computed_at: string | null
          reliability_score: number | null
          reliability_window_days: number | null
          status: string
          tax_id: string | null
          total_deliveries: number
          updated_at: string
          vehicle_types: Json
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          auto_suspended_at?: string | null
          auto_suspension_reason?: string | null
          company_name: string
          contact_email: string
          contact_phone: string
          created_at?: string
          declared_riders_count?: number
          fleet_vehicles?: Json
          headquarters_address?: string | null
          headquarters_city: string
          headquarters_country?: string
          id?: string
          is_active?: boolean
          is_platform_owned?: boolean
          legal_name?: string | null
          logo_url?: string | null
          max_riders?: number
          owner_user_id: string
          platform_commission_pct?: number
          rating_avg?: number | null
          registration_number?: string | null
          rejection_reason?: string | null
          reliability_computed_at?: string | null
          reliability_score?: number | null
          reliability_window_days?: number | null
          status?: string
          tax_id?: string | null
          total_deliveries?: number
          updated_at?: string
          vehicle_types?: Json
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          auto_suspended_at?: string | null
          auto_suspension_reason?: string | null
          company_name?: string
          contact_email?: string
          contact_phone?: string
          created_at?: string
          declared_riders_count?: number
          fleet_vehicles?: Json
          headquarters_address?: string | null
          headquarters_city?: string
          headquarters_country?: string
          id?: string
          is_active?: boolean
          is_platform_owned?: boolean
          legal_name?: string | null
          logo_url?: string | null
          max_riders?: number
          owner_user_id?: string
          platform_commission_pct?: number
          rating_avg?: number | null
          registration_number?: string | null
          rejection_reason?: string | null
          reliability_computed_at?: string | null
          reliability_score?: number | null
          reliability_window_days?: number | null
          status?: string
          tax_id?: string | null
          total_deliveries?: number
          updated_at?: string
          vehicle_types?: Json
        }
        Relationships: []
      }
      delivery_subscriptions: {
        Row: {
          created_at: string
          hub_storage: boolean
          id: string
          is_active: boolean
          max_riders: number
          paid_until: string | null
          plan_type: string
          price: number
          store_id: string | null
          tier: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          hub_storage?: boolean
          id?: string
          is_active?: boolean
          max_riders?: number
          paid_until?: string | null
          plan_type: string
          price?: number
          store_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          hub_storage?: boolean
          id?: string
          is_active?: boolean
          max_riders?: number
          paid_until?: string | null
          plan_type?: string
          price?: number
          store_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          city: string
          country: string
          created_at: string
          created_by_admin: boolean
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          created_by_admin?: boolean
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          created_by_admin?: boolean
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "disputes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      error_reports: {
        Row: {
          admin_notes: string | null
          browser: string | null
          component_stack: string | null
          created_at: string
          error_message: string
          error_stack: string | null
          id: string
          is_pwa: boolean | null
          os: string | null
          page_path: string | null
          resolved_at: string | null
          resolved_by: string | null
          screen_height: number | null
          screen_width: number | null
          severity: string | null
          status: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          admin_notes?: string | null
          browser?: string | null
          component_stack?: string | null
          created_at?: string
          error_message: string
          error_stack?: string | null
          id?: string
          is_pwa?: boolean | null
          os?: string | null
          page_path?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screen_height?: number | null
          screen_width?: number | null
          severity?: string | null
          status?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          admin_notes?: string | null
          browser?: string | null
          component_stack?: string | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          id?: string
          is_pwa?: boolean | null
          os?: string | null
          page_path?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screen_height?: number | null
          screen_width?: number | null
          severity?: string | null
          status?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
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
          internal_link: string | null
          message: string | null
          price_quoted: number | null
          product_ids: string[]
          request_type: string | null
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
          internal_link?: string | null
          message?: string | null
          price_quoted?: number | null
          product_ids?: string[]
          request_type?: string | null
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
          internal_link?: string | null
          message?: string | null
          price_quoted?: number | null
          product_ids?: string[]
          request_type?: string | null
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
          {
            foreignKeyName: "featured_placement_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
          image_url_2: string | null
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
          image_url_2?: string | null
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
          image_url_2?: string | null
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
            foreignKeyName: "featured_placements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_placements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_placements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_sales: {
        Row: {
          created_at: string
          ends_at: string
          flash_price: number
          id: string
          is_active: boolean
          max_quantity: number | null
          original_price: number
          product_id: string
          sold_quantity: number
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          flash_price: number
          id?: string
          is_active?: boolean
          max_quantity?: number | null
          original_price: number
          product_id: string
          sold_quantity?: number
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          flash_price?: number
          id?: string
          is_active?: boolean
          max_quantity?: number | null
          original_price?: number
          product_id?: string
          sold_quantity?: number
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      forwarder_cbm_tiers: {
        Row: {
          created_at: string
          id: string
          is_quote_only: boolean
          max_cbm: number | null
          min_cbm: number
          price_per_cbm: number | null
          profile_id: string
          sort_order: number
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_quote_only?: boolean
          max_cbm?: number | null
          min_cbm?: number
          price_per_cbm?: number | null
          profile_id: string
          sort_order?: number
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_quote_only?: boolean
          max_cbm?: number | null
          min_cbm?: number
          price_per_cbm?: number | null
          profile_id?: string
          sort_order?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "forwarder_cbm_tiers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "forwarder_pricing_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarder_cbm_tiers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_forwarder_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      forwarder_handoff_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          event_type: string
          field_name: string | null
          handoff_id: string
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          event_type: string
          field_name?: string | null
          handoff_id: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          event_type?: string
          field_name?: string | null
          handoff_id?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forwarder_handoff_events_handoff_id_fkey"
            columns: ["handoff_id"]
            isOneToOne: false
            referencedRelation: "forwarder_handoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      forwarder_handoffs: {
        Row: {
          acknowledged_at: string | null
          balance_amount: number
          balance_paid_amount: number
          balance_paid_at: string | null
          created_at: string
          deposit_amount: number
          deposit_paid_amount: number
          deposit_paid_at: string | null
          deposit_required: boolean
          forwarder_id: string
          freight_quote_id: string | null
          id: string
          intermediate_destination_city: string | null
          internal_notes: string | null
          is_active: boolean
          leg_index: number
          notification_payload: Json | null
          notified_at: string | null
          order_id: string
          parent_handoff_id: string | null
          payment_currency: string
          payment_status: string
          profile_id: string | null
          reassignment_reason: string | null
          replaced_by_handoff_id: string | null
          status: string
          tracking_carrier: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          balance_amount?: number
          balance_paid_amount?: number
          balance_paid_at?: string | null
          created_at?: string
          deposit_amount?: number
          deposit_paid_amount?: number
          deposit_paid_at?: string | null
          deposit_required?: boolean
          forwarder_id: string
          freight_quote_id?: string | null
          id?: string
          intermediate_destination_city?: string | null
          internal_notes?: string | null
          is_active?: boolean
          leg_index?: number
          notification_payload?: Json | null
          notified_at?: string | null
          order_id: string
          parent_handoff_id?: string | null
          payment_currency?: string
          payment_status?: string
          profile_id?: string | null
          reassignment_reason?: string | null
          replaced_by_handoff_id?: string | null
          status?: string
          tracking_carrier?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          balance_amount?: number
          balance_paid_amount?: number
          balance_paid_at?: string | null
          created_at?: string
          deposit_amount?: number
          deposit_paid_amount?: number
          deposit_paid_at?: string | null
          deposit_required?: boolean
          forwarder_id?: string
          freight_quote_id?: string | null
          id?: string
          intermediate_destination_city?: string | null
          internal_notes?: string | null
          is_active?: boolean
          leg_index?: number
          notification_payload?: Json | null
          notified_at?: string | null
          order_id?: string
          parent_handoff_id?: string | null
          payment_currency?: string
          payment_status?: string
          profile_id?: string | null
          reassignment_reason?: string | null
          replaced_by_handoff_id?: string | null
          status?: string
          tracking_carrier?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forwarder_handoffs_forwarder_id_fkey"
            columns: ["forwarder_id"]
            isOneToOne: false
            referencedRelation: "forwarders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarder_handoffs_forwarder_id_fkey"
            columns: ["forwarder_id"]
            isOneToOne: false
            referencedRelation: "forwarders_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarder_handoffs_freight_quote_id_fkey"
            columns: ["freight_quote_id"]
            isOneToOne: false
            referencedRelation: "freight_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarder_handoffs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarder_handoffs_parent_handoff_id_fkey"
            columns: ["parent_handoff_id"]
            isOneToOne: false
            referencedRelation: "forwarder_handoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarder_handoffs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "forwarder_pricing_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarder_handoffs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_forwarder_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarder_handoffs_replaced_by_handoff_id_fkey"
            columns: ["replaced_by_handoff_id"]
            isOneToOne: false
            referencedRelation: "forwarder_handoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      forwarder_kg_tiers: {
        Row: {
          created_at: string
          flat_price: number | null
          id: string
          is_quote_only: boolean
          max_kg: number | null
          min_kg: number
          price_per_kg: number | null
          profile_id: string
          round_up_to_kg: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          flat_price?: number | null
          id?: string
          is_quote_only?: boolean
          max_kg?: number | null
          min_kg?: number
          price_per_kg?: number | null
          profile_id: string
          round_up_to_kg?: boolean
          sort_order?: number
        }
        Update: {
          created_at?: string
          flat_price?: number | null
          id?: string
          is_quote_only?: boolean
          max_kg?: number | null
          min_kg?: number
          price_per_kg?: number | null
          profile_id?: string
          round_up_to_kg?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "forwarder_kg_tiers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "forwarder_pricing_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarder_kg_tiers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_forwarder_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      forwarder_piece_tiers: {
        Row: {
          category_id: string | null
          created_at: string
          custom_label: string | null
          id: string
          includes_customs: boolean
          min_quantity: number
          price: number
          pricing_unit: string
          profile_id: string
          sort_order: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          custom_label?: string | null
          id?: string
          includes_customs?: boolean
          min_quantity?: number
          price: number
          pricing_unit?: string
          profile_id: string
          sort_order?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          custom_label?: string | null
          id?: string
          includes_customs?: boolean
          min_quantity?: number
          price?: number
          pricing_unit?: string
          profile_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "forwarder_piece_tiers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "forwarder_pricing_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarder_piece_tiers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_forwarder_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpt_category_fk"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      forwarder_pricing_profiles: {
        Row: {
          city_id: string | null
          consolidation_enabled: boolean
          consolidation_fee_flat: number | null
          consolidation_fee_per_kg: number | null
          consolidation_min_packages: number
          country_code: string
          created_at: string
          currency: string
          deposit_pct: number
          deposit_threshold_cbm: number | null
          forwarder_id: string
          id: string
          is_active: boolean
          linked_transporter_user_id: string | null
          mode: string
          notes: string | null
          pickup_address: string | null
          pickup_email: string | null
          service_class: string
          transit_max_days: number | null
          transit_min_days: number | null
          updated_at: string
          volumetric_divisor: number | null
        }
        Insert: {
          city_id?: string | null
          consolidation_enabled?: boolean
          consolidation_fee_flat?: number | null
          consolidation_fee_per_kg?: number | null
          consolidation_min_packages?: number
          country_code: string
          created_at?: string
          currency?: string
          deposit_pct?: number
          deposit_threshold_cbm?: number | null
          forwarder_id: string
          id?: string
          is_active?: boolean
          linked_transporter_user_id?: string | null
          mode: string
          notes?: string | null
          pickup_address?: string | null
          pickup_email?: string | null
          service_class?: string
          transit_max_days?: number | null
          transit_min_days?: number | null
          updated_at?: string
          volumetric_divisor?: number | null
        }
        Update: {
          city_id?: string | null
          consolidation_enabled?: boolean
          consolidation_fee_flat?: number | null
          consolidation_fee_per_kg?: number | null
          consolidation_min_packages?: number
          country_code?: string
          created_at?: string
          currency?: string
          deposit_pct?: number
          deposit_threshold_cbm?: number | null
          forwarder_id?: string
          id?: string
          is_active?: boolean
          linked_transporter_user_id?: string | null
          mode?: string
          notes?: string | null
          pickup_address?: string | null
          pickup_email?: string | null
          service_class?: string
          transit_max_days?: number | null
          transit_min_days?: number | null
          updated_at?: string
          volumetric_divisor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fpp_city_fk"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpp_forwarder_fk"
            columns: ["forwarder_id"]
            isOneToOne: false
            referencedRelation: "forwarders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpp_forwarder_fk"
            columns: ["forwarder_id"]
            isOneToOne: false
            referencedRelation: "forwarders_public"
            referencedColumns: ["id"]
          },
        ]
      }
      forwarder_restrictions: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          label: string
          profile_id: string
          restriction_type: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          label: string
          profile_id: string
          restriction_type: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          label?: string
          profile_id?: string
          restriction_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "forwarder_restrictions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "forwarder_pricing_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarder_restrictions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_forwarder_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      forwarder_surcharges: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          currency: string
          id: string
          label: string
          profile_id: string
          sort_order: number
          surcharge_type: string
        }
        Insert: {
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          label: string
          profile_id: string
          sort_order?: number
          surcharge_type?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          label?: string
          profile_id?: string
          sort_order?: number
          surcharge_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "forwarder_surcharges_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarder_surcharges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "forwarder_pricing_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarder_surcharges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_forwarder_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      forwarders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          contact_email: string | null
          contact_phone: string | null
          coverage_routes: Json
          created_at: string
          description: string | null
          documents: Json
          estimated_monthly_volume_kg: number | null
          headquarters_address: string | null
          headquarters_city: string | null
          headquarters_country: string | null
          id: string
          is_active: boolean
          is_platform_owned: boolean
          legal_name: string | null
          linked_transporter_user_id: string | null
          logo_url: string | null
          name: string
          owner_user_id: string | null
          registration_number: string | null
          rejection_reason: string | null
          slug: string
          sort_order: number
          status: string
          submitted_at: string | null
          supported_modes: string[]
          tax_id: string | null
          unavailable_message: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          coverage_routes?: Json
          created_at?: string
          description?: string | null
          documents?: Json
          estimated_monthly_volume_kg?: number | null
          headquarters_address?: string | null
          headquarters_city?: string | null
          headquarters_country?: string | null
          id?: string
          is_active?: boolean
          is_platform_owned?: boolean
          legal_name?: string | null
          linked_transporter_user_id?: string | null
          logo_url?: string | null
          name: string
          owner_user_id?: string | null
          registration_number?: string | null
          rejection_reason?: string | null
          slug: string
          sort_order?: number
          status?: string
          submitted_at?: string | null
          supported_modes?: string[]
          tax_id?: string | null
          unavailable_message?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          coverage_routes?: Json
          created_at?: string
          description?: string | null
          documents?: Json
          estimated_monthly_volume_kg?: number | null
          headquarters_address?: string | null
          headquarters_city?: string | null
          headquarters_country?: string | null
          id?: string
          is_active?: boolean
          is_platform_owned?: boolean
          legal_name?: string | null
          linked_transporter_user_id?: string | null
          logo_url?: string | null
          name?: string
          owner_user_id?: string | null
          registration_number?: string | null
          rejection_reason?: string | null
          slug?: string
          sort_order?: number
          status?: string
          submitted_at?: string | null
          supported_modes?: string[]
          tax_id?: string | null
          unavailable_message?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      freight_quotes: {
        Row: {
          breakdown: Json
          category_id: string | null
          cbm: number
          created_at: string
          currency: string
          deposit_amount: number
          deposit_pct: number
          id: string
          order_id: string | null
          pieces_count: number
          profile_id: string
          quoted_price: number
          requires_deposit: boolean
          requires_manual_assignment: boolean
          restrictions_snapshot: Json
          status: string
          transit_max_days: number | null
          transit_min_days: number | null
          updated_at: string
          user_id: string
          valid_until: string
          weight_kg: number
          zone_fallback_amount: number | null
        }
        Insert: {
          breakdown?: Json
          category_id?: string | null
          cbm?: number
          created_at?: string
          currency?: string
          deposit_amount?: number
          deposit_pct?: number
          id?: string
          order_id?: string | null
          pieces_count?: number
          profile_id: string
          quoted_price?: number
          requires_deposit?: boolean
          requires_manual_assignment?: boolean
          restrictions_snapshot?: Json
          status?: string
          transit_max_days?: number | null
          transit_min_days?: number | null
          updated_at?: string
          user_id: string
          valid_until?: string
          weight_kg?: number
          zone_fallback_amount?: number | null
        }
        Update: {
          breakdown?: Json
          category_id?: string | null
          cbm?: number
          created_at?: string
          currency?: string
          deposit_amount?: number
          deposit_pct?: number
          id?: string
          order_id?: string | null
          pieces_count?: number
          profile_id?: string
          quoted_price?: number
          requires_deposit?: boolean
          requires_manual_assignment?: boolean
          restrictions_snapshot?: Json
          status?: string
          transit_max_days?: number | null
          transit_min_days?: number | null
          updated_at?: string
          user_id?: string
          valid_until?: string
          weight_kg?: number
          zone_fallback_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_quotes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_quotes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "forwarder_pricing_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_quotes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_forwarder_profiles_public"
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
      hub_storage_tracking: {
        Row: {
          arrived_at: string
          created_at: string
          daily_rate: number
          free_until: string
          id: string
          is_penalty_active: boolean
          last_penalty_at: string | null
          product_id: string | null
          store_id: string
          total_penalty: number
          updated_at: string
          weight_kg: number
        }
        Insert: {
          arrived_at?: string
          created_at?: string
          daily_rate?: number
          free_until?: string
          id?: string
          is_penalty_active?: boolean
          last_penalty_at?: string | null
          product_id?: string | null
          store_id: string
          total_penalty?: number
          updated_at?: string
          weight_kg?: number
        }
        Update: {
          arrived_at?: string
          created_at?: string
          daily_rate?: number
          free_until?: string
          id?: string
          is_penalty_active?: boolean
          last_penalty_at?: string | null
          product_id?: string | null
          store_id?: string
          total_penalty?: number
          updated_at?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "hub_storage_tracking_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_storage_tracking_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_tokens: {
        Row: {
          admin_id: string
          created_at: string
          expires_at: string
          id: string
          target_user_id: string
          token_hash: string | null
          used: boolean
        }
        Insert: {
          admin_id: string
          created_at?: string
          expires_at: string
          id?: string
          target_user_id: string
          token_hash?: string | null
          used?: boolean
        }
        Update: {
          admin_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          target_user_id?: string
          token_hash?: string | null
          used?: boolean
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
          confidence_score: number | null
          created_at: string
          document_back_url: string | null
          document_expiry: string | null
          document_front_url: string
          document_number: string | null
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
          confidence_score?: number | null
          created_at?: string
          document_back_url?: string | null
          document_expiry?: string | null
          document_front_url: string
          document_number?: string | null
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
          confidence_score?: number | null
          created_at?: string
          document_back_url?: string | null
          document_expiry?: string | null
          document_front_url?: string
          document_number?: string | null
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
      local_shipping_rates: {
        Row: {
          base_price: number
          city: string
          country: string
          created_at: string | null
          id: string
          price_per_km: number | null
          store_id: string | null
          updated_at: string | null
          vendor_override_allowed: boolean | null
          zone_name: string
        }
        Insert: {
          base_price?: number
          city?: string
          country?: string
          created_at?: string | null
          id?: string
          price_per_km?: number | null
          store_id?: string | null
          updated_at?: string | null
          vendor_override_allowed?: boolean | null
          zone_name: string
        }
        Update: {
          base_price?: number
          city?: string
          country?: string
          created_at?: string | null
          id?: string
          price_per_km?: number | null
          store_id?: string | null
          updated_at?: string | null
          vendor_override_allowed?: boolean | null
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_shipping_rates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_shipping_rates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
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
      operator_assignment_history: {
        Row: {
          created_at: string
          id: string
          new_operator_id: string | null
          order_id: string
          previous_operator_id: string | null
          reason: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          new_operator_id?: string | null
          order_id: string
          previous_operator_id?: string | null
          reason?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          new_operator_id?: string | null
          order_id?: string
          previous_operator_id?: string | null
          reason?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_assignment_history_new_operator_id_fkey"
            columns: ["new_operator_id"]
            isOneToOne: false
            referencedRelation: "delivery_operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignment_history_new_operator_id_fkey"
            columns: ["new_operator_id"]
            isOneToOne: false
            referencedRelation: "v_active_operators_by_city"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_assignment_history_new_operator_id_fkey"
            columns: ["new_operator_id"]
            isOneToOne: false
            referencedRelation: "v_operator_performance"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_assignment_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignment_history_previous_operator_id_fkey"
            columns: ["previous_operator_id"]
            isOneToOne: false
            referencedRelation: "delivery_operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignment_history_previous_operator_id_fkey"
            columns: ["previous_operator_id"]
            isOneToOne: false
            referencedRelation: "v_active_operators_by_city"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_assignment_history_previous_operator_id_fkey"
            columns: ["previous_operator_id"]
            isOneToOne: false
            referencedRelation: "v_operator_performance"
            referencedColumns: ["operator_id"]
          },
        ]
      }
      operator_commission_ledger: {
        Row: {
          currency: string
          delivery_fee: number
          id: string
          operator_id: string
          operator_net_amount: number
          order_id: string
          paid_at: string | null
          payout_status: string
          platform_commission_amount: number
          platform_commission_pct: number
          recorded_at: string
          rider_user_id: string | null
        }
        Insert: {
          currency?: string
          delivery_fee: number
          id?: string
          operator_id: string
          operator_net_amount: number
          order_id: string
          paid_at?: string | null
          payout_status?: string
          platform_commission_amount: number
          platform_commission_pct: number
          recorded_at?: string
          rider_user_id?: string | null
        }
        Update: {
          currency?: string
          delivery_fee?: number
          id?: string
          operator_id?: string
          operator_net_amount?: number
          order_id?: string
          paid_at?: string | null
          payout_status?: string
          platform_commission_amount?: number
          platform_commission_pct?: number
          recorded_at?: string
          rider_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_commission_ledger_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "delivery_operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_commission_ledger_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_active_operators_by_city"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_commission_ledger_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_operator_performance"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_commission_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_kyb_documents: {
        Row: {
          created_at: string
          doc_type: Database["public"]["Enums"]["operator_kyb_doc_type"]
          file_name: string
          file_path: string
          id: string
          mime_type: string
          operator_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number
          status: Database["public"]["Enums"]["operator_kyb_doc_status"]
          updated_at: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          doc_type: Database["public"]["Enums"]["operator_kyb_doc_type"]
          file_name: string
          file_path: string
          id?: string
          mime_type: string
          operator_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes: number
          status?: Database["public"]["Enums"]["operator_kyb_doc_status"]
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["operator_kyb_doc_type"]
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string
          operator_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number
          status?: Database["public"]["Enums"]["operator_kyb_doc_status"]
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_kyb_documents_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "delivery_operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_kyb_documents_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_active_operators_by_city"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_kyb_documents_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_operator_performance"
            referencedColumns: ["operator_id"]
          },
        ]
      }
      operator_quota_requests: {
        Row: {
          created_at: string
          current_quota: number
          id: string
          justification: string | null
          operator_id: string
          rejection_reason: string | null
          requested_quota: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          current_quota: number
          id?: string
          justification?: string | null
          operator_id: string
          rejection_reason?: string | null
          requested_quota: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          current_quota?: number
          id?: string
          justification?: string | null
          operator_id?: string
          rejection_reason?: string | null
          requested_quota?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_quota_requests_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "delivery_operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_quota_requests_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_active_operators_by_city"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_quota_requests_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_operator_performance"
            referencedColumns: ["operator_id"]
          },
        ]
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
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
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
          assigned_driver_id: string | null
          assigned_driver_name: string | null
          assigned_rider_id: string | null
          assigned_rider_name: string | null
          confirmation_code: string | null
          coupon_code: string | null
          created_at: string
          deferred_payment_phone: string | null
          deferred_payment_provider: string | null
          delivered_at: string | null
          delivery_address_confirmed: string | null
          delivery_choice: string | null
          delivery_date_requested: string | null
          delivery_operator_id: string | null
          delivery_option: string | null
          delivery_time_requested: string | null
          discount_amount: number | null
          freight_quote_id: string | null
          hub_pickup_proof_url: string | null
          id: string
          last_mile_fee: number | null
          last_mile_payment_method: string | null
          last_mile_payment_proof_url: string | null
          last_mile_payment_status: string | null
          operator_acceptance_status: string
          operator_assigned_at: string | null
          operator_decline_reason: string | null
          operator_reassignment_count: number
          operator_responded_at: string | null
          operator_response_deadline: string | null
          order_ref: string
          payment_method: string | null
          pickup_code: string | null
          pickup_code_generated_at: string | null
          pickup_code_verified_at: string | null
          pickup_verified_by: string | null
          review_reminder_count: number
          review_reminder_last: string | null
          rider_cash_collected: boolean | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_commune: string | null
          shipping_cost: number
          shipping_country: string | null
          shipping_email: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_mode: string | null
          shipping_payment_proof_url: string | null
          shipping_payment_status: string | null
          shipping_phone: string | null
          shipping_postal_code: string | null
          shipping_province: string | null
          shipping_quartier: string | null
          status: string
          store_id: string | null
          subtotal: number
          supplier_link: string | null
          supplier_order_number: string | null
          supplier_platform_id: string | null
          tip_amount: number | null
          total: number
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_driver_id?: string | null
          assigned_driver_name?: string | null
          assigned_rider_id?: string | null
          assigned_rider_name?: string | null
          confirmation_code?: string | null
          coupon_code?: string | null
          created_at?: string
          deferred_payment_phone?: string | null
          deferred_payment_provider?: string | null
          delivered_at?: string | null
          delivery_address_confirmed?: string | null
          delivery_choice?: string | null
          delivery_date_requested?: string | null
          delivery_operator_id?: string | null
          delivery_option?: string | null
          delivery_time_requested?: string | null
          discount_amount?: number | null
          freight_quote_id?: string | null
          hub_pickup_proof_url?: string | null
          id?: string
          last_mile_fee?: number | null
          last_mile_payment_method?: string | null
          last_mile_payment_proof_url?: string | null
          last_mile_payment_status?: string | null
          operator_acceptance_status?: string
          operator_assigned_at?: string | null
          operator_decline_reason?: string | null
          operator_reassignment_count?: number
          operator_responded_at?: string | null
          operator_response_deadline?: string | null
          order_ref: string
          payment_method?: string | null
          pickup_code?: string | null
          pickup_code_generated_at?: string | null
          pickup_code_verified_at?: string | null
          pickup_verified_by?: string | null
          review_reminder_count?: number
          review_reminder_last?: string | null
          rider_cash_collected?: boolean | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_commune?: string | null
          shipping_cost?: number
          shipping_country?: string | null
          shipping_email?: string | null
          shipping_first_name?: string | null
          shipping_last_name?: string | null
          shipping_mode?: string | null
          shipping_payment_proof_url?: string | null
          shipping_payment_status?: string | null
          shipping_phone?: string | null
          shipping_postal_code?: string | null
          shipping_province?: string | null
          shipping_quartier?: string | null
          status?: string
          store_id?: string | null
          subtotal?: number
          supplier_link?: string | null
          supplier_order_number?: string | null
          supplier_platform_id?: string | null
          tip_amount?: number | null
          total?: number
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_driver_id?: string | null
          assigned_driver_name?: string | null
          assigned_rider_id?: string | null
          assigned_rider_name?: string | null
          confirmation_code?: string | null
          coupon_code?: string | null
          created_at?: string
          deferred_payment_phone?: string | null
          deferred_payment_provider?: string | null
          delivered_at?: string | null
          delivery_address_confirmed?: string | null
          delivery_choice?: string | null
          delivery_date_requested?: string | null
          delivery_operator_id?: string | null
          delivery_option?: string | null
          delivery_time_requested?: string | null
          discount_amount?: number | null
          freight_quote_id?: string | null
          hub_pickup_proof_url?: string | null
          id?: string
          last_mile_fee?: number | null
          last_mile_payment_method?: string | null
          last_mile_payment_proof_url?: string | null
          last_mile_payment_status?: string | null
          operator_acceptance_status?: string
          operator_assigned_at?: string | null
          operator_decline_reason?: string | null
          operator_reassignment_count?: number
          operator_responded_at?: string | null
          operator_response_deadline?: string | null
          order_ref?: string
          payment_method?: string | null
          pickup_code?: string | null
          pickup_code_generated_at?: string | null
          pickup_code_verified_at?: string | null
          pickup_verified_by?: string | null
          review_reminder_count?: number
          review_reminder_last?: string | null
          rider_cash_collected?: boolean | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_commune?: string | null
          shipping_cost?: number
          shipping_country?: string | null
          shipping_email?: string | null
          shipping_first_name?: string | null
          shipping_last_name?: string | null
          shipping_mode?: string | null
          shipping_payment_proof_url?: string | null
          shipping_payment_status?: string | null
          shipping_phone?: string | null
          shipping_postal_code?: string | null
          shipping_province?: string | null
          shipping_quartier?: string | null
          status?: string
          store_id?: string | null
          subtotal?: number
          supplier_link?: string | null
          supplier_order_number?: string | null
          supplier_platform_id?: string | null
          tip_amount?: number | null
          total?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_operator_id_fkey"
            columns: ["delivery_operator_id"]
            isOneToOne: false
            referencedRelation: "delivery_operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_operator_id_fkey"
            columns: ["delivery_operator_id"]
            isOneToOne: false
            referencedRelation: "v_active_operators_by_city"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "orders_delivery_operator_id_fkey"
            columns: ["delivery_operator_id"]
            isOneToOne: false
            referencedRelation: "v_operator_performance"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "orders_freight_quote_id_fkey"
            columns: ["freight_quote_id"]
            isOneToOne: false
            referencedRelation: "freight_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_platform_id_fkey"
            columns: ["supplier_platform_id"]
            isOneToOne: false
            referencedRelation: "supplier_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          id: string
          page_path: string
          product_id: string | null
          session_id: string
          store_id: string | null
          time_on_page_seconds: number | null
          user_id: string | null
          viewed_at: string | null
        }
        Insert: {
          id?: string
          page_path: string
          product_id?: string | null
          session_id: string
          store_id?: string | null
          time_on_page_seconds?: number | null
          user_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          id?: string
          page_path?: string
          product_id?: string | null
          session_id?: string
          store_id?: string | null
          time_on_page_seconds?: number | null
          user_id?: string | null
          viewed_at?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          label: string | null
          phone_number: string
          provider: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          phone_number: string
          provider: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          phone_number?: string
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          callback_payload: Json | null
          card_token_id: string | null
          created_at: string
          currency: string
          id: string
          method: string
          order_id: string
          payment_type: string | null
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
          card_token_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          method?: string
          order_id: string
          payment_type?: string | null
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
          card_token_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          method?: string
          order_id?: string
          payment_type?: string | null
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
            foreignKeyName: "payment_transactions_card_token_id_fkey"
            columns: ["card_token_id"]
            isOneToOne: false
            referencedRelation: "saved_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_card_token_id_fkey"
            columns: ["card_token_id"]
            isOneToOne: false
            referencedRelation: "saved_cards_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_ownership_claims: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          resolved_at: string | null
          status: string
          store_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          resolved_at?: string | null
          status?: string
          store_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          resolved_at?: string | null
          status?: string
          store_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_ownership_claims_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_ownership_claims_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_service_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          label: string
          price_monthly: number
          price_yearly: number
          service_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          label: string
          price_monthly?: number
          price_yearly?: number
          service_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          label?: string
          price_monthly?: number
          price_yearly?: number
          service_key?: string
          updated_at?: string
        }
        Relationships: []
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
      premium_subscriptions: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          plan_name: string
          price: number
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          plan_name?: string
          price?: number
          start_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          plan_name?: string
          price?: number
          start_date?: string
          user_id?: string
        }
        Relationships: []
      }
      product_bundles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          name: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          name: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_bundles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_bundles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "product_colors_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_custom_variant_values: {
        Row: {
          created_at: string
          custom_label: string
          id: string
          product_id: string
          variant_type_id: string
        }
        Insert: {
          created_at?: string
          custom_label: string
          id?: string
          product_id: string
          variant_type_id: string
        }
        Update: {
          created_at?: string
          custom_label?: string
          id?: string
          product_id?: string
          variant_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_custom_variant_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_custom_variant_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_custom_variant_values_variant_type_id_fkey"
            columns: ["variant_type_id"]
            isOneToOne: false
            referencedRelation: "variant_types"
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
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
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
          {
            foreignKeyName: "product_pricing_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
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
          {
            foreignKeyName: "product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sourcing_requests: {
        Row: {
          admin_notified_email: boolean
          client_seen_response: boolean
          created_at: string
          email_digest_sent: boolean
          id: string
          images: string[]
          note: string | null
          product_name: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notified_email?: boolean
          client_seen_response?: boolean
          created_at?: string
          email_digest_sent?: boolean
          id?: string
          images?: string[]
          note?: string | null
          product_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notified_email?: boolean
          client_seen_response?: boolean
          created_at?: string
          email_digest_sent?: boolean
          id?: string
          images?: string[]
          note?: string | null
          product_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sourcing_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sourcing_responses: {
        Row: {
          colors: string[]
          created_at: string
          currency: string
          description: string | null
          id: string
          image_url: string | null
          min_quantity: number | null
          notify_email_sent: boolean
          price: number | null
          product_name: string
          request_id: string
          responder_id: string | null
          updated_at: string
        }
        Insert: {
          colors?: string[]
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          min_quantity?: number | null
          notify_email_sent?: boolean
          price?: number | null
          product_name: string
          request_id: string
          responder_id?: string | null
          updated_at?: string
        }
        Update: {
          colors?: string[]
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          min_quantity?: number | null
          notify_email_sent?: boolean
          price?: number | null
          product_name?: string
          request_id?: string
          responder_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sourcing_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "product_sourcing_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sourcing_responses_responder_fk"
            columns: ["responder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "product_variant_selections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
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
          auto_pricing_enabled: boolean
          can_ship_air: boolean
          can_ship_sea: boolean
          care_instructions: string | null
          category_id: string | null
          cost_calc: number | null
          cost_real: number | null
          created_at: string
          currency: string
          description: string | null
          discount: number | null
          flash_timer_duration_hours: number | null
          flash_timer_enabled: boolean | null
          gender_target: string | null
          height_cm: number | null
          id: string
          is_new: boolean | null
          is_sale: boolean | null
          length_cm: number | null
          material: string | null
          meta_description: string | null
          meta_title: string | null
          model_size: string | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          moderation_reason_link: string | null
          moq: number | null
          name: string
          name_fr: string
          origin_country: string | null
          original_price: number | null
          prep_days_max: number | null
          prep_days_min: number | null
          price: number
          promo_end_date: string | null
          promo_start_date: string | null
          publish_status: string
          rating: number | null
          review_count: number | null
          review_count_override: number | null
          sales_count: number
          sales_count_override: number | null
          season: string | null
          seo_keywords: string[] | null
          short_description: string | null
          sku: string | null
          slug: string
          stock_quantity: number | null
          store_id: string | null
          style: string | null
          supplier_id: string | null
          supplier_product_id: string | null
          transaction_fee_pct: number | null
          trend_tag_id: string | null
          updated_at: string
          vendor_extra_margin: number | null
          verified_years: number | null
          verified_years_override: number | null
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          auto_pricing_enabled?: boolean
          can_ship_air?: boolean
          can_ship_sea?: boolean
          care_instructions?: string | null
          category_id?: string | null
          cost_calc?: number | null
          cost_real?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          discount?: number | null
          flash_timer_duration_hours?: number | null
          flash_timer_enabled?: boolean | null
          gender_target?: string | null
          height_cm?: number | null
          id?: string
          is_new?: boolean | null
          is_sale?: boolean | null
          length_cm?: number | null
          material?: string | null
          meta_description?: string | null
          meta_title?: string | null
          model_size?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_reason_link?: string | null
          moq?: number | null
          name: string
          name_fr: string
          origin_country?: string | null
          original_price?: number | null
          prep_days_max?: number | null
          prep_days_min?: number | null
          price: number
          promo_end_date?: string | null
          promo_start_date?: string | null
          publish_status?: string
          rating?: number | null
          review_count?: number | null
          review_count_override?: number | null
          sales_count?: number
          sales_count_override?: number | null
          season?: string | null
          seo_keywords?: string[] | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock_quantity?: number | null
          store_id?: string | null
          style?: string | null
          supplier_id?: string | null
          supplier_product_id?: string | null
          transaction_fee_pct?: number | null
          trend_tag_id?: string | null
          updated_at?: string
          vendor_extra_margin?: number | null
          verified_years?: number | null
          verified_years_override?: number | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          auto_pricing_enabled?: boolean
          can_ship_air?: boolean
          can_ship_sea?: boolean
          care_instructions?: string | null
          category_id?: string | null
          cost_calc?: number | null
          cost_real?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          discount?: number | null
          flash_timer_duration_hours?: number | null
          flash_timer_enabled?: boolean | null
          gender_target?: string | null
          height_cm?: number | null
          id?: string
          is_new?: boolean | null
          is_sale?: boolean | null
          length_cm?: number | null
          material?: string | null
          meta_description?: string | null
          meta_title?: string | null
          model_size?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_reason_link?: string | null
          moq?: number | null
          name?: string
          name_fr?: string
          origin_country?: string | null
          original_price?: number | null
          prep_days_max?: number | null
          prep_days_min?: number | null
          price?: number
          promo_end_date?: string | null
          promo_start_date?: string | null
          publish_status?: string
          rating?: number | null
          review_count?: number | null
          review_count_override?: number | null
          sales_count?: number
          sales_count_override?: number | null
          season?: string | null
          seo_keywords?: string[] | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock_quantity?: number | null
          store_id?: string | null
          style?: string | null
          supplier_id?: string | null
          supplier_product_id?: string | null
          transaction_fee_pct?: number | null
          trend_tag_id?: string | null
          updated_at?: string
          vendor_extra_margin?: number | null
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
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_trend_tag_id_fkey"
            columns: ["trend_tag_id"]
            isOneToOne: false
            referencedRelation: "trend_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          affiliate_tier: string | null
          allowed_channels: string[] | null
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          banned_by: string | null
          created_at: string
          customer_tier: string
          date_of_birth: string | null
          display_id: number
          email: string | null
          first_name: string | null
          gdpr_consent_at: string | null
          gender: string | null
          id: string
          is_banned: boolean
          is_certified: boolean
          is_online: boolean
          last_known_geo_at: string | null
          last_known_lat: number | null
          last_known_lng: number | null
          last_login_at: string | null
          last_name: string | null
          last_seen_at: string | null
          login_count: number | null
          nationality: string | null
          notifications_enabled: boolean | null
          phone: string | null
          preferred_contact_channel: string | null
          preferred_language: string | null
          referral_code: string | null
          residence_address: string | null
          residence_city: string | null
          residence_commune: string | null
          residence_country: string | null
          residence_province: string | null
          residence_province_id: string | null
          residence_quartier: string | null
          updated_at: string
        }
        Insert: {
          affiliate_tier?: string | null
          allowed_channels?: string[] | null
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          created_at?: string
          customer_tier?: string
          date_of_birth?: string | null
          display_id?: number
          email?: string | null
          first_name?: string | null
          gdpr_consent_at?: string | null
          gender?: string | null
          id: string
          is_banned?: boolean
          is_certified?: boolean
          is_online?: boolean
          last_known_geo_at?: string | null
          last_known_lat?: number | null
          last_known_lng?: number | null
          last_login_at?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          login_count?: number | null
          nationality?: string | null
          notifications_enabled?: boolean | null
          phone?: string | null
          preferred_contact_channel?: string | null
          preferred_language?: string | null
          referral_code?: string | null
          residence_address?: string | null
          residence_city?: string | null
          residence_commune?: string | null
          residence_country?: string | null
          residence_province?: string | null
          residence_province_id?: string | null
          residence_quartier?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_tier?: string | null
          allowed_channels?: string[] | null
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          created_at?: string
          customer_tier?: string
          date_of_birth?: string | null
          display_id?: number
          email?: string | null
          first_name?: string | null
          gdpr_consent_at?: string | null
          gender?: string | null
          id?: string
          is_banned?: boolean
          is_certified?: boolean
          is_online?: boolean
          last_known_geo_at?: string | null
          last_known_lat?: number | null
          last_known_lng?: number | null
          last_login_at?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          login_count?: number | null
          nationality?: string | null
          notifications_enabled?: boolean | null
          phone?: string | null
          preferred_contact_channel?: string | null
          preferred_language?: string | null
          referral_code?: string | null
          residence_address?: string | null
          residence_city?: string | null
          residence_commune?: string | null
          residence_country?: string | null
          residence_province?: string | null
          residence_province_id?: string | null
          residence_quartier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provinces: {
        Row: {
          country_code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          country_code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          country_code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
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
      pwa_installs: {
        Row: {
          browser: string | null
          created_at: string
          device_id: string | null
          device_type: string | null
          id: string
          last_seen_at: string | null
          os: string | null
          session_id: string
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_id?: string | null
          device_type?: string | null
          id?: string
          last_seen_at?: string | null
          os?: string | null
          session_id: string
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_id?: string | null
          device_type?: string | null
          id?: string
          last_seen_at?: string | null
          os?: string | null
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      quartiers: {
        Row: {
          commune_id: string
          created_at: string | null
          delivery_surcharge_legacy_deprecated: number | null
          id: string
          is_active: boolean | null
          is_restricted: boolean | null
          name: string
          restriction_reason: string | null
        }
        Insert: {
          commune_id: string
          created_at?: string | null
          delivery_surcharge_legacy_deprecated?: number | null
          id?: string
          is_active?: boolean | null
          is_restricted?: boolean | null
          name: string
          restriction_reason?: string | null
        }
        Update: {
          commune_id?: string
          created_at?: string | null
          delivery_surcharge_legacy_deprecated?: number | null
          id?: string
          is_active?: boolean | null
          is_restricted?: boolean | null
          name?: string
          restriction_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quartiers_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_entries: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
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
      restricted_zones: {
        Row: {
          city: string
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          reason: string | null
          zone_name: string
        }
        Insert: {
          city: string
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          reason?: string | null
          zone_name: string
        }
        Update: {
          city?: string
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          reason?: string | null
          zone_name?: string
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
          {
            foreignKeyName: "return_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          comment: string
          created_at: string
          helpful_count: number
          id: string
          images: string[] | null
          is_approved: boolean
          is_verified_purchase: boolean
          product_id: string
          rating: number
          reward_granted: boolean
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          comment?: string
          created_at?: string
          helpful_count?: number
          id?: string
          images?: string[] | null
          is_approved?: boolean
          is_verified_purchase?: boolean
          product_id: string
          rating: number
          reward_granted?: boolean
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          comment?: string
          created_at?: string
          helpful_count?: number
          id?: string
          images?: string[] | null
          is_approved?: boolean
          is_verified_purchase?: boolean
          product_id?: string
          rating?: number
          reward_granted?: boolean
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
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
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
      rider_ratings: {
        Row: {
          comment: string | null
          created_at: string
          delivery_id: string | null
          id: string
          order_id: string | null
          rating: number
          rider_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          delivery_id?: string | null
          id?: string
          order_id?: string | null
          rating: number
          rider_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          delivery_id?: string | null
          id?: string
          order_id?: string | null
          rating?: number
          rider_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_ratings_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_addresses: {
        Row: {
          address: string
          city: string
          commune: string | null
          country: string
          created_at: string
          first_name: string
          id: string
          is_default: boolean
          is_first_address: boolean
          label: string
          last_name: string
          phone: string
          postal_code: string | null
          province: string | null
          province_id: string | null
          quartier: string | null
          user_id: string
        }
        Insert: {
          address: string
          city: string
          commune?: string | null
          country?: string
          created_at?: string
          first_name: string
          id?: string
          is_default?: boolean
          is_first_address?: boolean
          label?: string
          last_name: string
          phone: string
          postal_code?: string | null
          province?: string | null
          province_id?: string | null
          quartier?: string | null
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          commune?: string | null
          country?: string
          created_at?: string
          first_name?: string
          id?: string
          is_default?: boolean
          is_first_address?: boolean
          label?: string
          last_name?: string
          phone?: string
          postal_code?: string | null
          province?: string | null
          province_id?: string | null
          quartier?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_cards: {
        Row: {
          card_brand: string | null
          card_token: string
          created_at: string | null
          expiry_month: number | null
          expiry_year: number | null
          id: string
          is_default: boolean | null
          label: string | null
          last_four: string
          provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_brand?: string | null
          card_token: string
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          last_four: string
          provider?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_brand?: string | null
          card_token?: string
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          last_four?: string
          provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      scheduled_campaigns: {
        Row: {
          batch_interval_minutes: number
          batch_size: number
          campaign_type: string
          created_at: string
          days_before: number | null
          html_content: string
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          promo_code: string | null
          schedule_day: number | null
          schedule_month: number | null
          subject: string
          updated_at: string
        }
        Insert: {
          batch_interval_minutes?: number
          batch_size?: number
          campaign_type: string
          created_at?: string
          days_before?: number | null
          html_content?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          promo_code?: string | null
          schedule_day?: number | null
          schedule_month?: number | null
          subject: string
          updated_at?: string
        }
        Update: {
          batch_interval_minutes?: number
          batch_size?: number
          campaign_type?: string
          created_at?: string
          days_before?: number | null
          html_content?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          promo_code?: string | null
          schedule_day?: number | null
          schedule_month?: number | null
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_packages: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          hub_storage_free_kg: number
          id: string
          included_services: string[]
          is_active: boolean
          max_collaborators: number | null
          max_deliveries_per_day: number
          max_riders: number
          name: string
          price_monthly: number
          price_yearly: number
          rank: number
          slug: string
          target: string
          trust_threshold_months: number | null
          trust_threshold_sales: number | null
          updated_at: string
          visibility_level: string
          withdrawal_delay_days: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          hub_storage_free_kg?: number
          id?: string
          included_services?: string[]
          is_active?: boolean
          max_collaborators?: number | null
          max_deliveries_per_day?: number
          max_riders?: number
          name: string
          price_monthly?: number
          price_yearly?: number
          rank?: number
          slug: string
          target?: string
          trust_threshold_months?: number | null
          trust_threshold_sales?: number | null
          updated_at?: string
          visibility_level?: string
          withdrawal_delay_days?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          hub_storage_free_kg?: number
          id?: string
          included_services?: string[]
          is_active?: boolean
          max_collaborators?: number | null
          max_deliveries_per_day?: number
          max_riders?: number
          name?: string
          price_monthly?: number
          price_yearly?: number
          rank?: number
          slug?: string
          target?: string
          trust_threshold_months?: number | null
          trust_threshold_sales?: number | null
          updated_at?: string
          visibility_level?: string
          withdrawal_delay_days?: number
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
      sms_provider_config: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          provider: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          provider?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_change_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string
          old_value: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          store_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value: string
          old_value?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string
          old_value?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_change_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_change_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_email: string | null
          permissions: string[] | null
          role: string
          status: string
          store_id: string
          sub_role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_email?: string | null
          permissions?: string[] | null
          role?: string
          status?: string
          store_id: string
          sub_role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_email?: string | null
          permissions?: string[] | null
          role?: string
          status?: string
          store_id?: string
          sub_role?: string | null
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
          {
            foreignKeyName: "store_collaborators_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
          {
            foreignKeyName: "store_coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
          {
            foreignKeyName: "store_followers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_package_subscriptions: {
        Row: {
          billing_cycle: string
          created_at: string
          id: string
          is_active: boolean
          package_id: string
          paid_until: string | null
          store_id: string
          subscribed_at: string
          trust_unlocked: boolean
          trust_unlocked_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          id?: string
          is_active?: boolean
          package_id: string
          paid_until?: string | null
          store_id: string
          subscribed_at?: string
          trust_unlocked?: boolean
          trust_unlocked_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          id?: string
          is_active?: boolean
          package_id?: string
          paid_until?: string | null
          store_id?: string
          subscribed_at?: string
          trust_unlocked?: boolean
          trust_unlocked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_package_subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_package_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_package_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payment_numbers: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          operator: string
          operator_label: string
          phone_number: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          operator: string
          operator_label: string
          phone_number?: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          operator?: string
          operator_label?: string
          phone_number?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payment_numbers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_payment_numbers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_quick_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_quick_replies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_quick_replies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
          {
            foreignKeyName: "store_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_transfer_requests: {
        Row: {
          admin_notes: string | null
          claim_warning_accepted: boolean | null
          cooldown_until: string | null
          created_at: string | null
          documents: string[] | null
          from_user_id: string
          id: string
          kyc_verified_from: boolean | null
          kyc_verified_to: boolean | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          store_id: string
          to_user_id: string
          transfer_type: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          claim_warning_accepted?: boolean | null
          cooldown_until?: string | null
          created_at?: string | null
          documents?: string[] | null
          from_user_id: string
          id?: string
          kyc_verified_from?: boolean | null
          kyc_verified_to?: boolean | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id: string
          to_user_id: string
          transfer_type?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          claim_warning_accepted?: boolean | null
          cooldown_until?: string | null
          created_at?: string | null
          documents?: string[] | null
          from_user_id?: string
          id?: string
          kyc_verified_from?: boolean | null
          kyc_verified_to?: boolean | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id?: string
          to_user_id?: string
          transfer_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_transfer_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transfer_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          ban_reason: string | null
          banned_at: string | null
          banned_by: string | null
          banner_url: string | null
          can_create_coupons: boolean
          chat_links_allowed: boolean
          chat_media_enabled: boolean | null
          chat_phone_allowed: boolean
          city: string | null
          collaborators_enabled: boolean
          country: string | null
          created_at: string
          default_transit_days_max: number | null
          default_transit_days_min: number | null
          description: string | null
          flash_timer_duration_hours: number | null
          flash_timer_enabled: boolean | null
          fleet_management: string
          followers_count: number | null
          followers_override: number | null
          fulfillment_type: string
          id: string
          is_banned: boolean
          is_certified: boolean
          is_online: boolean | null
          is_platform_owned: boolean
          is_suspended: boolean
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
          presence_visible: boolean
          products_count: number | null
          rating: number | null
          repurchase_rate: string | null
          response_rate: string | null
          response_time: string | null
          returns_enabled: boolean
          review_count_override: number | null
          sales_count: number | null
          sales_override: number | null
          sales_trend: string | null
          seo_keywords: string[] | null
          shop_type: string
          slug: string | null
          suspended_activities: string[] | null
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          verified_years: number | null
          verified_years_override: number | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          banner_url?: string | null
          can_create_coupons?: boolean
          chat_links_allowed?: boolean
          chat_media_enabled?: boolean | null
          chat_phone_allowed?: boolean
          city?: string | null
          collaborators_enabled?: boolean
          country?: string | null
          created_at?: string
          default_transit_days_max?: number | null
          default_transit_days_min?: number | null
          description?: string | null
          flash_timer_duration_hours?: number | null
          flash_timer_enabled?: boolean | null
          fleet_management?: string
          followers_count?: number | null
          followers_override?: number | null
          fulfillment_type?: string
          id?: string
          is_banned?: boolean
          is_certified?: boolean
          is_online?: boolean | null
          is_platform_owned?: boolean
          is_suspended?: boolean
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
          presence_visible?: boolean
          products_count?: number | null
          rating?: number | null
          repurchase_rate?: string | null
          response_rate?: string | null
          response_time?: string | null
          returns_enabled?: boolean
          review_count_override?: number | null
          sales_count?: number | null
          sales_override?: number | null
          sales_trend?: string | null
          seo_keywords?: string[] | null
          shop_type?: string
          slug?: string | null
          suspended_activities?: string[] | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          verified_years?: number | null
          verified_years_override?: number | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          banner_url?: string | null
          can_create_coupons?: boolean
          chat_links_allowed?: boolean
          chat_media_enabled?: boolean | null
          chat_phone_allowed?: boolean
          city?: string | null
          collaborators_enabled?: boolean
          country?: string | null
          created_at?: string
          default_transit_days_max?: number | null
          default_transit_days_min?: number | null
          description?: string | null
          flash_timer_duration_hours?: number | null
          flash_timer_enabled?: boolean | null
          fleet_management?: string
          followers_count?: number | null
          followers_override?: number | null
          fulfillment_type?: string
          id?: string
          is_banned?: boolean
          is_certified?: boolean
          is_online?: boolean | null
          is_platform_owned?: boolean
          is_suspended?: boolean
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
          presence_visible?: boolean
          products_count?: number | null
          rating?: number | null
          repurchase_rate?: string | null
          response_rate?: string | null
          response_time?: string | null
          returns_enabled?: boolean
          review_count_override?: number | null
          sales_count?: number | null
          sales_override?: number | null
          sales_trend?: string | null
          seo_keywords?: string[] | null
          shop_type?: string
          slug?: string | null
          suspended_activities?: string[] | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          verified_years?: number | null
          verified_years_override?: number | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          amount: number
          billing_cycle: string
          callback_payload: Json | null
          created_at: string
          currency: string
          id: string
          package_id: string | null
          payment_method: string
          phone_number: string | null
          provider: string | null
          reference: string
          service_key: string | null
          status: string
          store_id: string | null
          subscription_type: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          billing_cycle?: string
          callback_payload?: Json | null
          created_at?: string
          currency?: string
          id?: string
          package_id?: string | null
          payment_method?: string
          phone_number?: string | null
          provider?: string | null
          reference: string
          service_key?: string | null
          status?: string
          store_id?: string | null
          subscription_type?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          callback_payload?: Json | null
          created_at?: string
          currency?: string
          id?: string
          package_id?: string | null
          payment_method?: string
          phone_number?: string | null
          provider?: string | null
          reference?: string
          service_key?: string | null
          status?: string
          store_id?: string | null
          subscription_type?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_platforms: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      supplier_products: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          label: string
          position: number
          product_url: string | null
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string
          position?: number
          product_url?: string | null
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string
          position?: number
          product_url?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          agent_name: string
          average_processing_time: string | null
          created_at: string
          direct_contact: string | null
          email: string
          id: string
          platform_id: string | null
          platform_name: string
          product_image_url: string | null
          seniority: string | null
          store_url: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          agent_name: string
          average_processing_time?: string | null
          created_at?: string
          direct_contact?: string | null
          email?: string
          id?: string
          platform_id?: string | null
          platform_name?: string
          product_image_url?: string | null
          seniority?: string | null
          store_url?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          agent_name?: string
          average_processing_time?: string | null
          created_at?: string
          direct_contact?: string | null
          email?: string
          id?: string
          platform_id?: string | null
          platform_name?: string
          product_image_url?: string | null
          seniority?: string | null
          store_url?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "supplier_platforms"
            referencedColumns: ["id"]
          },
        ]
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
      trend_tags: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          name_fr: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_fr: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_fr?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      trending_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "trending_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trending_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
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
          fleet_management: string | null
          fulfillment_type: string | null
          full_name: string | null
          id: string
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shop_type: string | null
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
          fleet_management?: string | null
          fulfillment_type?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_type?: string | null
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
          fleet_management?: string | null
          fulfillment_type?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_type?: string | null
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
      vendor_boosts: {
        Row: {
          amount_paid: number
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          start_date: string
          store_id: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          start_date?: string
          store_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          start_date?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_boosts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_boosts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_customer_reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          order_id: string
          rating: number
          store_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          order_id: string
          rating: number
          store_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string
          rating?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_customer_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_customer_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_customer_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "vendor_delivery_zones_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
      vendor_pricing_overrides: {
        Row: {
          collaborator_limit_override: number | null
          commission_rate: number | null
          created_at: string
          id: string
          margin_pct: number | null
          max_extra_margin: number | null
          max_multiplier: number | null
          max_products_override: number | null
          multiplier: number | null
          notes: string | null
          shipping_labels_enabled: boolean
          store_id: string
          suppliers_enabled: boolean
          updated_at: string
          vendor_card_enabled: boolean
          vendor_cod_enabled: boolean
          vendor_custom_payment_numbers_enabled: boolean
          vendor_extra_margin_enabled: boolean
          vendor_mobile_money_enabled: boolean
          vendor_mode: string
          vendor_off_platform_enabled: boolean
          vendor_webhook_url: string | null
          webhook_approved: boolean
        }
        Insert: {
          collaborator_limit_override?: number | null
          commission_rate?: number | null
          created_at?: string
          id?: string
          margin_pct?: number | null
          max_extra_margin?: number | null
          max_multiplier?: number | null
          max_products_override?: number | null
          multiplier?: number | null
          notes?: string | null
          shipping_labels_enabled?: boolean
          store_id: string
          suppliers_enabled?: boolean
          updated_at?: string
          vendor_card_enabled?: boolean
          vendor_cod_enabled?: boolean
          vendor_custom_payment_numbers_enabled?: boolean
          vendor_extra_margin_enabled?: boolean
          vendor_mobile_money_enabled?: boolean
          vendor_mode?: string
          vendor_off_platform_enabled?: boolean
          vendor_webhook_url?: string | null
          webhook_approved?: boolean
        }
        Update: {
          collaborator_limit_override?: number | null
          commission_rate?: number | null
          created_at?: string
          id?: string
          margin_pct?: number | null
          max_extra_margin?: number | null
          max_multiplier?: number | null
          max_products_override?: number | null
          multiplier?: number | null
          notes?: string | null
          shipping_labels_enabled?: boolean
          store_id?: string
          suppliers_enabled?: boolean
          updated_at?: string
          vendor_card_enabled?: boolean
          vendor_cod_enabled?: boolean
          vendor_custom_payment_numbers_enabled?: boolean
          vendor_extra_margin_enabled?: boolean
          vendor_mobile_money_enabled?: boolean
          vendor_mode?: string
          vendor_off_platform_enabled?: boolean
          vendor_webhook_url?: string | null
          webhook_approved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "vendor_pricing_overrides_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_pricing_overrides_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_subscriptions: {
        Row: {
          active_services: Json | null
          can_self_deliver: boolean
          created_at: string
          id: string
          is_whatsapp_enabled: boolean
          max_products: number
          paid_until: string | null
          payment_method: string | null
          service_paid_until: string | null
          store_id: string
          tier: Database["public"]["Enums"]["vendor_tier"]
          updated_at: string
        }
        Insert: {
          active_services?: Json | null
          can_self_deliver?: boolean
          created_at?: string
          id?: string
          is_whatsapp_enabled?: boolean
          max_products?: number
          paid_until?: string | null
          payment_method?: string | null
          service_paid_until?: string | null
          store_id: string
          tier?: Database["public"]["Enums"]["vendor_tier"]
          updated_at?: string
        }
        Update: {
          active_services?: Json | null
          can_self_deliver?: boolean
          created_at?: string
          id?: string
          is_whatsapp_enabled?: boolean
          max_products?: number
          paid_until?: string | null
          payment_method?: string | null
          service_paid_until?: string | null
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
          {
            foreignKeyName: "vendor_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
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
            foreignKeyName: "vendor_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
          {
            foreignKeyName: "vendor_wallets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_api_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          requested_by: string
          requested_url: string
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
          requested_by: string
          requested_url: string
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
          requested_by?: string
          requested_url?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_api_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_api_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
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
          {
            foreignKeyName: "withdrawal_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
      automation_workflows_public: {
        Row: {
          channel: Database["public"]["Enums"]["automation_channel"] | null
          condition_has_account: boolean | null
          condition_has_order: boolean | null
          condition_max_days_since_signup: number | null
          delay_days: number | null
          delay_minutes: number | null
          display_frequency:
            | Database["public"]["Enums"]["automation_display_frequency"]
            | null
          id: string | null
          is_active: boolean | null
          max_displays: number | null
          name: string | null
          popup_content: string | null
          popup_cta_label: string | null
          popup_cta_link: string | null
          popup_image_url: string | null
          popup_title: string | null
          sort_order: number | null
          trigger_type:
            | Database["public"]["Enums"]["automation_trigger_type"]
            | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["automation_channel"] | null
          condition_has_account?: boolean | null
          condition_has_order?: boolean | null
          condition_max_days_since_signup?: number | null
          delay_days?: number | null
          delay_minutes?: number | null
          display_frequency?:
            | Database["public"]["Enums"]["automation_display_frequency"]
            | null
          id?: string | null
          is_active?: boolean | null
          max_displays?: number | null
          name?: string | null
          popup_content?: string | null
          popup_cta_label?: string | null
          popup_cta_link?: string | null
          popup_image_url?: string | null
          popup_title?: string | null
          sort_order?: number | null
          trigger_type?:
            | Database["public"]["Enums"]["automation_trigger_type"]
            | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["automation_channel"] | null
          condition_has_account?: boolean | null
          condition_has_order?: boolean | null
          condition_max_days_since_signup?: number | null
          delay_days?: number | null
          delay_minutes?: number | null
          display_frequency?:
            | Database["public"]["Enums"]["automation_display_frequency"]
            | null
          id?: string | null
          is_active?: boolean | null
          max_displays?: number | null
          name?: string | null
          popup_content?: string | null
          popup_cta_label?: string | null
          popup_cta_link?: string | null
          popup_image_url?: string | null
          popup_title?: string | null
          sort_order?: number | null
          trigger_type?:
            | Database["public"]["Enums"]["automation_trigger_type"]
            | null
        }
        Relationships: []
      }
      forwarders_public: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          slug: string | null
          sort_order: number | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          sort_order?: number | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          sort_order?: number | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      products_public: {
        Row: {
          auto_pricing_enabled: boolean | null
          care_instructions: string | null
          category_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          discount: number | null
          flash_timer_duration_hours: number | null
          flash_timer_enabled: boolean | null
          height_cm: number | null
          id: string | null
          is_new: boolean | null
          is_sale: boolean | null
          length_cm: number | null
          material: string | null
          meta_description: string | null
          meta_title: string | null
          model_size: string | null
          moq: number | null
          name: string | null
          name_fr: string | null
          origin_country: string | null
          original_price: number | null
          prep_days_max: number | null
          prep_days_min: number | null
          price: number | null
          promo_end_date: string | null
          promo_start_date: string | null
          publish_status: string | null
          rating: number | null
          review_count: number | null
          review_count_override: number | null
          sales_count: number | null
          sales_count_override: number | null
          season: string | null
          seo_keywords: string[] | null
          short_description: string | null
          sku: string | null
          slug: string | null
          stock_quantity: number | null
          store_id: string | null
          style: string | null
          supplier_id: string | null
          trend_tag_id: string | null
          updated_at: string | null
          verified_years: number | null
          verified_years_override: number | null
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          auto_pricing_enabled?: boolean | null
          care_instructions?: string | null
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          discount?: number | null
          flash_timer_duration_hours?: number | null
          flash_timer_enabled?: boolean | null
          height_cm?: number | null
          id?: string | null
          is_new?: boolean | null
          is_sale?: boolean | null
          length_cm?: number | null
          material?: string | null
          meta_description?: string | null
          meta_title?: string | null
          model_size?: string | null
          moq?: number | null
          name?: string | null
          name_fr?: string | null
          origin_country?: string | null
          original_price?: number | null
          prep_days_max?: number | null
          prep_days_min?: number | null
          price?: number | null
          promo_end_date?: string | null
          promo_start_date?: string | null
          publish_status?: string | null
          rating?: number | null
          review_count?: number | null
          review_count_override?: number | null
          sales_count?: number | null
          sales_count_override?: number | null
          season?: string | null
          seo_keywords?: string[] | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          stock_quantity?: number | null
          store_id?: string | null
          style?: string | null
          supplier_id?: string | null
          trend_tag_id?: string | null
          updated_at?: string | null
          verified_years?: number | null
          verified_years_override?: number | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          auto_pricing_enabled?: boolean | null
          care_instructions?: string | null
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          discount?: number | null
          flash_timer_duration_hours?: number | null
          flash_timer_enabled?: boolean | null
          height_cm?: number | null
          id?: string | null
          is_new?: boolean | null
          is_sale?: boolean | null
          length_cm?: number | null
          material?: string | null
          meta_description?: string | null
          meta_title?: string | null
          model_size?: string | null
          moq?: number | null
          name?: string | null
          name_fr?: string | null
          origin_country?: string | null
          original_price?: number | null
          prep_days_max?: number | null
          prep_days_min?: number | null
          price?: number | null
          promo_end_date?: string | null
          promo_start_date?: string | null
          publish_status?: string | null
          rating?: number | null
          review_count?: number | null
          review_count_override?: number | null
          sales_count?: number | null
          sales_count_override?: number | null
          season?: string | null
          seo_keywords?: string[] | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          stock_quantity?: number | null
          store_id?: string | null
          style?: string | null
          supplier_id?: string | null
          trend_tag_id?: string | null
          updated_at?: string | null
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
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_trend_tag_id_fkey"
            columns: ["trend_tag_id"]
            isOneToOne: false
            referencedRelation: "trend_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_cards_safe: {
        Row: {
          card_brand: string | null
          created_at: string | null
          expiry_month: number | null
          expiry_year: number | null
          id: string | null
          is_default: boolean | null
          label: string | null
          last_four: string | null
          provider: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          card_brand?: string | null
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string | null
          is_default?: boolean | null
          label?: string | null
          last_four?: string | null
          provider?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          card_brand?: string | null
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string | null
          is_default?: boolean | null
          label?: string | null
          last_four?: string | null
          provider?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      stores_public: {
        Row: {
          address: string | null
          banner_url: string | null
          chat_links_allowed: boolean | null
          chat_media_enabled: boolean | null
          chat_phone_allowed: boolean | null
          city: string | null
          country: string | null
          created_at: string | null
          default_transit_days_max: number | null
          default_transit_days_min: number | null
          description: string | null
          flash_timer_duration_hours: number | null
          flash_timer_enabled: boolean | null
          followers_count: number | null
          followers_override: number | null
          fulfillment_type: string | null
          id: string | null
          is_banned: boolean | null
          is_certified: boolean | null
          is_online: boolean | null
          is_platform_owned: boolean | null
          is_suspended: boolean | null
          is_verified: boolean | null
          last_seen_at: string | null
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          name: string | null
          presence_visible: boolean | null
          products_count: number | null
          rating: number | null
          repurchase_rate: string | null
          response_rate: string | null
          response_time: string | null
          returns_enabled: boolean | null
          review_count_override: number | null
          sales_count: number | null
          sales_override: number | null
          sales_trend: string | null
          seo_keywords: string[] | null
          shop_type: string | null
          slug: string | null
          suspended_activities: string[] | null
          verified_years: number | null
          verified_years_override: number | null
        }
        Insert: {
          address?: string | null
          banner_url?: string | null
          chat_links_allowed?: boolean | null
          chat_media_enabled?: boolean | null
          chat_phone_allowed?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          default_transit_days_max?: number | null
          default_transit_days_min?: number | null
          description?: string | null
          flash_timer_duration_hours?: number | null
          flash_timer_enabled?: boolean | null
          followers_count?: number | null
          followers_override?: number | null
          fulfillment_type?: string | null
          id?: string | null
          is_banned?: boolean | null
          is_certified?: boolean | null
          is_online?: boolean | null
          is_platform_owned?: boolean | null
          is_suspended?: boolean | null
          is_verified?: boolean | null
          last_seen_at?: string | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string | null
          presence_visible?: boolean | null
          products_count?: number | null
          rating?: number | null
          repurchase_rate?: string | null
          response_rate?: string | null
          response_time?: string | null
          returns_enabled?: boolean | null
          review_count_override?: number | null
          sales_count?: number | null
          sales_override?: number | null
          sales_trend?: string | null
          seo_keywords?: string[] | null
          shop_type?: string | null
          slug?: string | null
          suspended_activities?: string[] | null
          verified_years?: number | null
          verified_years_override?: number | null
        }
        Update: {
          address?: string | null
          banner_url?: string | null
          chat_links_allowed?: boolean | null
          chat_media_enabled?: boolean | null
          chat_phone_allowed?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          default_transit_days_max?: number | null
          default_transit_days_min?: number | null
          description?: string | null
          flash_timer_duration_hours?: number | null
          flash_timer_enabled?: boolean | null
          followers_count?: number | null
          followers_override?: number | null
          fulfillment_type?: string | null
          id?: string | null
          is_banned?: boolean | null
          is_certified?: boolean | null
          is_online?: boolean | null
          is_platform_owned?: boolean | null
          is_suspended?: boolean | null
          is_verified?: boolean | null
          last_seen_at?: string | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string | null
          presence_visible?: boolean | null
          products_count?: number | null
          rating?: number | null
          repurchase_rate?: string | null
          response_rate?: string | null
          response_time?: string | null
          returns_enabled?: boolean | null
          review_count_override?: number | null
          sales_count?: number | null
          sales_override?: number | null
          sales_trend?: string | null
          seo_keywords?: string[] | null
          shop_type?: string | null
          slug?: string | null
          suspended_activities?: string[] | null
          verified_years?: number | null
          verified_years_override?: number | null
        }
        Relationships: []
      }
      v_active_operators_by_city: {
        Row: {
          city: string | null
          company_name: string | null
          country_code: string | null
          is_platform_owned: boolean | null
          logo_url: string | null
          min_eta_minutes: number | null
          min_fee_preview: number | null
          operator_id: string | null
          rating_avg: number | null
          total_deliveries: number | null
        }
        Relationships: []
      }
      v_forwarder_profiles_public: {
        Row: {
          city_id: string | null
          country_code: string | null
          created_at: string | null
          currency: string | null
          deposit_pct: number | null
          deposit_threshold_cbm: number | null
          forwarder_id: string | null
          id: string | null
          is_active: boolean | null
          mode: string | null
          notes: string | null
          service_class: string | null
          transit_max_days: number | null
          transit_min_days: number | null
          updated_at: string | null
          volumetric_divisor: number | null
        }
        Insert: {
          city_id?: string | null
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          deposit_pct?: number | null
          deposit_threshold_cbm?: number | null
          forwarder_id?: string | null
          id?: string | null
          is_active?: boolean | null
          mode?: string | null
          notes?: string | null
          service_class?: string | null
          transit_max_days?: number | null
          transit_min_days?: number | null
          updated_at?: string | null
          volumetric_divisor?: number | null
        }
        Update: {
          city_id?: string | null
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          deposit_pct?: number | null
          deposit_threshold_cbm?: number | null
          forwarder_id?: string | null
          id?: string | null
          is_active?: boolean | null
          mode?: string | null
          notes?: string | null
          service_class?: string | null
          transit_max_days?: number | null
          transit_min_days?: number | null
          updated_at?: string | null
          volumetric_divisor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fpp_city_fk"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpp_forwarder_fk"
            columns: ["forwarder_id"]
            isOneToOne: false
            referencedRelation: "forwarders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpp_forwarder_fk"
            columns: ["forwarder_id"]
            isOneToOne: false
            referencedRelation: "forwarders_public"
            referencedColumns: ["id"]
          },
        ]
      }
      v_geo_coverage_status: {
        Row: {
          country_code: string | null
          has_cities: boolean | null
          has_communes: boolean | null
          has_provinces: boolean | null
        }
        Relationships: []
      }
      v_operator_performance: {
        Row: {
          acceptance_rate: number | null
          accepted_count: number | null
          auto_suspended_at: string | null
          auto_suspension_reason: string | null
          avg_response_minutes: number | null
          company_name: string | null
          customer_rating_avg: number | null
          customer_rating_count: number | null
          decline_rate: number | null
          declined_count: number | null
          delivered_count: number | null
          expired_count: number | null
          expiry_rate: number | null
          is_active: boolean | null
          is_platform_owned: boolean | null
          operator_id: string | null
          pending_count: number | null
          rating_avg: number | null
          reliability_computed_at: string | null
          reliability_score: number | null
          reliability_window_days: number | null
          status: string | null
          total_assignments: number | null
          total_deliveries: number | null
        }
        Relationships: []
      }
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
      add_intermediate_hub_handoff: {
        Args: {
          p_destination_city: string
          p_hub_forwarder_id: string
          p_order_id: string
          p_reason?: string
        }
        Returns: string
      }
      admin_get_user_label: {
        Args: { p_user_id: string }
        Returns: {
          display_label: string
          email: string
          id: string
        }[]
      }
      admin_search_users: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          display_label: string
          email: string
          first_name: string
          id: string
          last_name: string
        }[]
      }
      can_access_store_orders: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      can_activate_certification: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      check_kyc_required: { Args: { p_user_id: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_requests: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      cleanup_old_activity_logs: { Args: never; Returns: undefined }
      cleanup_old_analytics_events: { Args: never; Returns: number }
      cleanup_old_read_notifications: { Args: never; Returns: number }
      cleanup_rate_limit_entries: { Args: never; Returns: undefined }
      cleanup_resolved_error_reports: { Args: never; Returns: number }
      cleanup_sourcing_requests: {
        Args: { p_older_than_days: number }
        Returns: {
          deleted_count: number
          image_paths: string[]
        }[]
      }
      compute_operator_reliability: {
        Args: { p_operator_id: string; p_window_days?: number }
        Returns: {
          acceptance_rate: number
          accepted_count: number
          avg_response_minutes: number
          customer_rating_avg: number
          customer_rating_count: number
          decline_rate: number
          declined_count: number
          delivered_count: number
          expired_count: number
          expiry_rate: number
          operator_id: string
          pending_count: number
          score: number
          total_assignments: number
          window_days: number
        }[]
      }
      compute_store_online_status: {
        Args: { p_store_id: string }
        Returns: boolean
      }
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
      deduct_points: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      expire_inactive_points: {
        Args: { months_limit?: number }
        Returns: number
      }
      expire_old_freight_quotes: { Args: never; Returns: number }
      get_analytics_daily_extended: {
        Args: { p_since?: string }
        Returns: {
          day: string
          orders: number
          signups: number
          visitors: number
        }[]
      }
      get_analytics_daily_traffic: {
        Args: { p_since?: string }
        Returns: {
          day: string
          visitors: number
        }[]
      }
      get_analytics_devices: { Args: { p_since?: string }; Returns: Json }
      get_analytics_kpis: { Args: { p_since?: string }; Returns: Json }
      get_analytics_top_cities:
        | {
            Args: { p_since?: string }
            Returns: {
              city: string
              country: string
              session_count: number
            }[]
          }
        | {
            Args: { p_limit?: number; p_since?: string }
            Returns: {
              city: string
              country: string
              page_views: number
              sessions: number
            }[]
          }
      get_analytics_top_countries:
        | {
            Args: { p_since?: string }
            Returns: {
              country: string
              session_count: number
            }[]
          }
        | {
            Args: { p_limit?: number; p_since?: string }
            Returns: {
              country: string
              page_views: number
              sessions: number
            }[]
          }
      get_analytics_top_pages: {
        Args: { p_limit?: number; p_since?: string }
        Returns: {
          page_path: string
          view_count: number
        }[]
      }
      get_analytics_top_products: {
        Args: { p_limit?: number; p_since?: string }
        Returns: {
          click_count: number
          product_id: string
          product_name: string
        }[]
      }
      get_analytics_top_stores: {
        Args: { p_limit?: number; p_since?: string }
        Returns: {
          store_id: string
          store_name: string
          view_count: number
        }[]
      }
      get_automation_daily_events: {
        Args: { p_since?: string; p_workflow_id?: string }
        Returns: {
          clicked: number
          converted: number
          day: string
          delivered: number
        }[]
      }
      get_automation_kpis: {
        Args: { p_since?: string; p_workflow_id?: string }
        Returns: Json
      }
      get_automation_user_journey: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_since?: string
          p_workflow_id?: string
        }
        Returns: {
          anon_id: string
          clicked: boolean
          converted_order: boolean
          converted_signup: boolean
          delivered_at: string
          user_email: string
          user_full_name: string
          user_id: string
          workflow_id: string
          workflow_name: string
        }[]
      }
      get_automation_workflow_performance: {
        Args: { p_since?: string }
        Returns: {
          clicked: number
          converted: number
          delivered: number
          workflow_id: string
          workflow_name: string
        }[]
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
      get_eligible_forwarders: {
        Args: { p_city_id: string; p_country: string; p_mode: string }
        Returns: {
          forwarder_id: string
          forwarder_name: string
          forwarder_slug: string
          has_profile_for_zone: boolean
          is_platform_owned: boolean
          logo_url: string
          mode: string
          price_multiplier: number
          tier: string
          transit_max_days: number
          transit_min_days: number
          unavailable_message: string
        }[]
      }
      get_guest_support_ticket: {
        Args: { p_requester_email: string; p_ticket_id: string }
        Returns: Json
      }
      get_operator_coverage: {
        Args: {
          p_city: string
          p_commune?: string
          p_country: string
          p_quartier?: string
        }
        Returns: boolean
      }
      get_pickup_code_for_order: {
        Args: { _order_id: string }
        Returns: string
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
      increment_coupon_uses: {
        Args: { p_coupon_id: string; p_table: string }
        Returns: undefined
      }
      increment_helpful: { Args: { review_id: string }; Returns: undefined }
      is_kyc_order_blocked: { Args: { p_user_id: string }; Returns: boolean }
      is_kyc_verified: { Args: { p_user_id: string }; Returns: boolean }
      is_operator_owner: {
        Args: { _operator_id: string; _uid: string }
        Returns: boolean
      }
      is_operator_rider: {
        Args: { _operator_id: string; _uid: string }
        Returns: boolean
      }
      operator_decide_order: {
        Args: { p_decision: string; p_order_id: string; p_reason?: string }
        Returns: Json
      }
      quote_forwarder:
        | {
            Args: { p_items: Json; p_profile_id: string; p_total_cbm?: number }
            Returns: Json
          }
        | {
            Args: {
              p_consolidation_choice?: string
              p_items: Json
              p_profile_id: string
              p_total_cbm?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_items: Json
              p_profile_id: string
              p_total_cbm?: number
              p_total_weight_kg?: number
            }
            Returns: Json
          }
      reassign_forwarder: {
        Args: {
          p_actor_role?: string
          p_handoff_id: string
          p_new_forwarder_id: string
          p_reason: string
        }
        Returns: string
      }
      refresh_all_operator_reliability: { Args: never; Returns: number }
      refresh_store_online_status: {
        Args: { p_store_id: string }
        Returns: undefined
      }
      release_pending_wallet_funds: {
        Args: { p_store_id: string }
        Returns: undefined
      }
      release_vendor_pending_funds: { Args: never; Returns: number }
      search_users_admin: {
        Args: { term: string }
        Returns: {
          city: string
          created_at: string
          email: string
          first_name: string
          is_kyc_verified: boolean
          last_name: string
          user_id: string
        }[]
      }
      set_store_offline: { Args: { p_store_id: string }; Returns: undefined }
      set_user_offline: { Args: { p_user_id: string }; Returns: undefined }
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
      update_own_profile: {
        Args: {
          p_allowed_channels?: string[]
          p_avatar_url?: string
          p_date_of_birth?: string
          p_first_name?: string
          p_gender?: string
          p_last_name?: string
          p_nationality?: string
          p_notifications_enabled?: boolean
          p_phone?: string
          p_preferred_contact_channel?: string
          p_preferred_language?: string
          p_residence_address?: string
          p_residence_city?: string
        }
        Returns: undefined
      }
      update_store_presence: {
        Args: { p_store_id: string }
        Returns: undefined
      }
      update_user_presence: { Args: { p_user_id: string }; Returns: undefined }
      upsert_rate_limit: {
        Args: {
          p_key: string
          p_max_requests?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      user_owns_any_operator: { Args: { _uid: string }; Returns: boolean }
      validate_coupon: {
        Args: { p_code: string }
        Returns: {
          code: string
          current_uses: number
          discount_type: string
          discount_value: number
          expires_at: string
          max_uses: number
          min_order_amount: number
          target_city: string
          target_country: string
        }[]
      }
      verify_order_pickup_code: {
        Args: { _code: string; _order_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "vendor"
        | "shipper"
        | "rider"
        | "forwarder"
        | "operator"
      automation_channel:
        | "popup"
        | "push"
        | "email"
        | "popup_push"
        | "push_email"
        | "all"
      automation_display_frequency:
        | "every_visit"
        | "once"
        | "daily"
        | "once_per_session"
      automation_trigger_type:
        | "visit_no_account"
        | "account_created"
        | "visit_no_order"
        | "product_viewed_no_order"
        | "no_order_delay"
        | "referral_prompt"
        | "custom"
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
      operator_kyb_doc_status: "pending" | "approved" | "rejected"
      operator_kyb_doc_type:
        | "rccm"
        | "nif"
        | "id_card"
        | "business_license"
        | "insurance"
        | "tax_clearance"
        | "other"
      product_status: "draft" | "pending_approval" | "published" | "rejected"
      vendor_tier:
        | "beginner"
        | "intermediate"
        | "pro"
        | "grand_supplier"
        | "factory"
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
      app_role: [
        "admin",
        "manager",
        "vendor",
        "shipper",
        "rider",
        "forwarder",
        "operator",
      ],
      automation_channel: [
        "popup",
        "push",
        "email",
        "popup_push",
        "push_email",
        "all",
      ],
      automation_display_frequency: [
        "every_visit",
        "once",
        "daily",
        "once_per_session",
      ],
      automation_trigger_type: [
        "visit_no_account",
        "account_created",
        "visit_no_order",
        "product_viewed_no_order",
        "no_order_delay",
        "referral_prompt",
        "custom",
      ],
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
      operator_kyb_doc_status: ["pending", "approved", "rejected"],
      operator_kyb_doc_type: [
        "rccm",
        "nif",
        "id_card",
        "business_license",
        "insurance",
        "tax_clearance",
        "other",
      ],
      product_status: ["draft", "pending_approval", "published", "rejected"],
      vendor_tier: [
        "beginner",
        "intermediate",
        "pro",
        "grand_supplier",
        "factory",
      ],
    },
  },
} as const
