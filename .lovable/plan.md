

# Guide pas à pas : Exécution des migrations SQL sur Supabase

## Prérequis
- Connectez-vous à votre projet Supabase de production
- Allez dans **SQL Editor** (menu de gauche)

## Important : problème de doublon detecté
La migration **#47** (`20260228102627`) est un **doublon exact** de la migration **#46** (`20260227214001`) — elle recrée les mêmes tables CMS. Il faut la **sauter** sinon vous aurez une erreur `relation already exists`.

---

## Liste ordonnée des 66 migrations

Copiez le contenu de chaque fichier dans le SQL Editor, puis cliquez **Run**. Attendez la confirmation avant de passer au suivant.

| # | Fichier | Contenu principal | Où le trouver |
|---|---------|-------------------|---------------|
| **1** | `20260223231957_...` | Tables fondamentales : categories, stores, products, product_images, product_colors, product_sizes, profiles, cart_items, triggers updated_at, handle_new_user | `frontend/supabase/migrations/20260223231957_100d9c2f...sql` |
| **2** | `20260224005211_...` | short_description produits, product_pricing_tiers + tiers sample | `...20260224005211_3fb9c2af...sql` |
| **3** | `20260224013017_...` | Flash timer columns (stores + products) | `...20260224013017_0aa18755...sql` |
| **4** | `20260224084323_...` | whatsapp_number sur stores | `...20260224084323_1a5856f7...sql` |
| **5** | `20260224103416_...` | Conversations + Messages + realtime | `...20260224103416_173424ce...sql` |
| **6** | `20260224105628_...` | owner_id sur stores, policies conversations/messages pour store owners | `...20260224105628_75bca965...sql` |
| **7** | `20260224111447_...` | Policies CRUD produits + images pour store owners | `...20260224111447_548c9a65...sql` |
| **8** | `20260224115932_...` | Promo dates produits, bucket product-media + storage policies | `...20260224115932_9a14b4f1...sql` |
| **9** | `20260224121525_...` | Orders + Order Items + RLS + trigger updated_at | `...20260224121525_0c65400b...sql` |
| **10** | `20260224160840_...` | Wishlists | `...20260224160840_dc2b866c...sql` |
| **11** | `20260224161853_...` | Reviews + rating summary + review-images bucket + increment_helpful | `...20260224161853_b6861f7a...sql` |
| **12** | `20260224162058_...` | FK reviews.user_id → profiles | `...20260224162058_2f3dbc59...sql` |
| **13** | `20260225132704_...` | image_url sur categories | `...20260225132704_3ee7f440...sql` |
| **14** | `20260225133752_...` | Coupons + Saved Addresses + coupon_code/discount sur orders + seed coupons | `...20260225133752_91f3bd17...sql` |
| **15** | `20260225145042_...` | phone sur profiles | `...20260225145042_d20a9a69...sql` |
| **16** | `20260225152425_...` | banner_url, rating, response_rate/time sur stores | `...20260225152425_3215e68e...sql` |
| **17** | `20260225153846_...` | Notifications + triggers (order created, order status, new message) | `...20260225153846_c0f26232...sql` |
| **18** | `20260225160502_...` | Recréation triggers notifications (idempotent) | `...20260225160502_e42c7f97...sql` |
| **19** | `20260225165933_...` | Push subscriptions | `...20260225165933_c17befc8...sql` |
| **20** | `20260225202951_...` | app_role enum + user_roles + has_role() + get_user_roles() + RLS admin/manager | `...20260225202951_c8d757e8...sql` |
| **21** | `20260225204941_...` | Policies CRUD catégories pour staff | `...20260225204941_99c256e4...sql` |
| **22** | `20260225212711_...` | Shipments + Deliveries + realtime | `...20260225212711_46a0242d...sql` |
| **23** | `20260225220444_...` | Bucket delivery-proofs + signature_url | `...20260225220444_eed8d502...sql` |
| **24** | `20260225223315_...` | Functions track_shipment + track_delivery | `...20260225223315_fb7586b9...sql` |
| **25** | `20260225224829_...` | Triggers notify_delivery_status + notify_shipment_status | `...20260225224829_e927f5f1...sql` |
| **26** | `20260226093635_...` | Shipping zones, routes, category surcharges, shipping defaults, weight/dimensions produits | `...20260226093635_07532b45...sql` |
| **27** | `20260226110132_...` | Cities + haversine_distance + logistic_zones + seed zones | `...20260226110132_eaa7fc3c...sql` |
| **28** | `20260226151506_...` | chat_media_enabled + bucket chat-media | `...20260226151506_5f318c84...sql` |
| **29** | `20260226161836_...` | Vendor applications + vendor documents + bucket vendor-documents | `...20260226161836_4442d12d...sql` |
| **30** | `20260226164330_...` | Policies insert/delete stores pour staff | `...20260226164330_7f1abc7e...sql` |
| **31** | `20260226173835_...` | pending_name + name_change_status sur stores | `...20260226173835_639a650a...sql` |
| **32** | `20260226180957_...` | Realtime pour products, orders, stores | `...20260226180957_6c2c30de...sql` |
| **33** | `20260226195525_...` | Vendor subscriptions, product status, order_status_history, vendor_delivery_zones | `...20260226195525_682f1f7c...sql` |
| **34** | `20260226195615_...` | Fix INSERT policy order_status_history | `...20260226195615_c9f5633f...sql` |
| **35** | `20260226223351_...` | Ban fields profiles + user_warnings + staff update profiles | `...20260226223351_1975c763...sql` |
| **36** | `20260226224122_...` | Admin audit logs | `...20260226224122_e367356f...sql` |
| **37** | `20260226232957_...` | Customer tiers + badge requests + loyalty stats function | `...20260226232957_ab503181...sql` |
| **38** | `20260226234725_...` | Restrict badge approval to admin only | `...20260226234725_645c31dd...sql` |
| **39** | `20260226235233_...` | Users cancel own orders policy | `...20260226235233_7c8e7cce...sql` |
| **40** | `20260227120805_...` | Store coupons (vendor-specific) | `...20260227120805_6dd6c402...sql` |
| **41** | `20260227122336_...` | Platform settings + free_shipping_threshold | `...20260227122336_e596c03a...sql` |
| **42** | `20260227125056_...` | Referrals + ZandoPoints + point_transactions + referral_settings | `...20260227125056_6e4106f9...sql` |
| **43** | `20260227130734_...` | Trigger finalize_referral_points | `...20260227130734_4581a409...sql` |
| **44** | `20260227131734_...` | Trigger create_pending_referral_points | `...20260227131734_8d4f2ac7...sql` |
| **45** | `20260227141215_...` | Update referral triggers with notifications | `...20260227141215_023f3241...sql` |
| **46** | `20260227214001_...` | CMS: banners, menu_items, pages, homepage_sections, bucket cms-assets | `...20260227214001_aed6db61...sql` |
| **47** | ~~`20260228102627_...`~~ | **SAUTER** — doublon exact de #46 (erreur `relation already exists`) | |
| **48** | `20260228091155_...` | is_starred conversations, read_at messages, chat policies admin | `...20260228091155_a4b1e3b9...sql` |
| **49** | `20260228124039_...` | can_create_coupons stores + staff manage coupons policy | `...20260228124039_78340945...sql` |
| **50** | `20260228124626_...` | Vendor wallets, vendor transactions, withdrawal requests | `...20260228124626_2ed8c11f...sql` |
| **51** | `20260228125318_...` | Trigger credit_vendor_wallet_on_delivery + release_vendor_pending_funds | `...20260228125318_c34a3b46...sql` |
| **52** | `20260228130031_...` | Return requests, disputes, dispute_messages, store_reviews, exchange_rates, affiliate_tiers | `...20260228130031_f35f1123...sql` |
| **53** | `20260228131903_...` | Vendor policies product_colors/sizes/pricing_tiers + prevent self-upvote + unique store review | `...20260228131903_c2823896...sql` |
| **54** | `20260228134913_...` | stock_quantity + triggers return/dispute notifications + decrement_stock | `...20260228134913_f9b2525a...sql` |
| **55** | `20260228145846_...` | No-op (SELECT 1) | `...20260228145846_2cc4d525...sql` |
| **56** | `20260228151217_...` | Payment transactions + realtime | `...20260228151217_836cc4e6...sql` |
| **57** | `20260228155020_...` | SEO fields produits/stores + platform_settings seo | `...20260228155020_f77fc24c...sql` |
| **58** | `20260228171713_...` | Rider locations + delivery coords + realtime | `...20260228171713_ef147be3...sql` |
| **59** | `20260228200816_...` | Hub arrival + rider assignment triggers + order columns (tracking, delivery_choice, rider) | `...20260228200816_0f705a4b...sql` |
| **60** | `20260228204619_...` | Cancellation requests | `...20260228204619_0fbd7100...sql` |
| **61** | `20260301092352_...` | Store followers, cms_popups, store functions, triggers sync counts | `...20260301092352_70d35723...sql` |
| **62** | `20260301095334_...` | Product/store override columns + review stats trigger | `...20260301095334_3c76950b...sql` |
| **63** | `20260301102101_...` | Trigger sync products_count + followers_count | `...20260301102101_2b365c01...sql` |
| **64** | `20260301111601_...` | gender + date_of_birth sur profiles | `...20260301111601_63697099...sql` |
| **65** | `20260301112927_...` | Notifications admin insert/read policies | `...20260301112927_25080305...sql` |
| **66** | `20260301114304_...` | subtitle + cta cms_banners + newness_duration_days setting | `...20260301114304_004e3720...sql` |

---

## Comment procéder concrètement

Pour chaque migration :

1. Ouvrez le fichier dans votre projet (chemin : `frontend/supabase/migrations/[nom_fichier].sql`)
2. Copiez **tout** le contenu SQL
3. Dans Supabase Dashboard → **SQL Editor** → **New query**
4. Collez le SQL et cliquez **Run**
5. Vérifiez le message "Success" en bas
6. Passez au suivant

### Si une erreur survient :
- **"relation already exists"** → la table existe deja, passez au suivant
- **"policy already exists"** → la policy existe deja, commentez la ligne et relancez
- **"column already exists"** → l'ALTER TABLE IF NOT EXISTS devrait gérer, sinon passez

### Alternative recommandée (CLI) :
Si vous avez installé le CLI Supabase, tout cela peut se faire en une seule commande :
```bash
supabase link --project-ref VOTRE_PROJECT_REF
supabase db push
```
Cela exécutera automatiquement toutes les 66 migrations dans l'ordre, en sautant celles deja appliquées.

