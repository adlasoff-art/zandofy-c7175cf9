-- Purpose: SEO recovery — home/discover overrides + 5 commercial blog pillars (RDC/import).
-- Tables: seo_page_overrides, blog_posts
-- Rollback: DELETE blog_posts WHERE slug IN (...); restore overrides manually if needed.
-- Risk: low — additive upserts; blog seed skipped if no admin author exists.

-- ---------------------------------------------------------------------------
-- 1) Page overrides (apex-oriented commercial copy)
-- ---------------------------------------------------------------------------
INSERT INTO public.seo_page_overrides (path, title, description, robots, keywords)
VALUES
  (
    '/',
    'Zandofy — Achetez en Chine, livré en Afrique | Prix usine',
    'Marketplace sino-africaine : import Chine & Turquie, prix usine, livraison suivie en RDC (Kinshasa) et en Afrique. Fournisseurs fiables, support en français.',
    'index,follow',
    ARRAY['achat en chine','import rdc','marketplace afrique','kinshasa','prix usine','fournisseur fiable']
  ),
  (
    '/discover',
    'Découvrir Zandofy — Import Chine & Turquie vers l’Afrique',
    'Comment acheter en Chine ou en Turquie et recevoir en RDC avec Zandofy : catalogue, paiement sécurisé, logistique et suivi jusqu’à Kinshasa.',
    'index,follow',
    ARRAY['découvrir zandofy','import chine afrique','livraison kinshasa','ecommerce rdc']
  )
ON CONFLICT (path) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  robots = EXCLUDED.robots,
  keywords = EXCLUDED.keywords,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Commercial pillar posts (published when an admin author exists)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT ur.user_id INTO admin_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::public.app_role
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE NOTICE '[seo pillars] No admin user_roles row — skip blog_posts seed (publish via CMS).';
    RETURN;
  END IF;

  INSERT INTO public.blog_posts (
    title, slug, excerpt, content, author_id, status, featured, tags,
    reading_time_min, meta_title, meta_description, seo_keywords,
    schema_type, published_at, updated_at
  ) VALUES
  (
    'Acheter en Chine livré en RDC (Kinshasa) : guide Zandofy',
    'achat-en-chine-livre-rdc-kinshasa',
    'Comment importer depuis la Chine vers Kinshasa avec une marketplace : prix usine, logistique et suivi.',
    $html$
<h2>Pourquoi acheter en Chine depuis la RDC ?</h2>
<p>Les commerçants et particuliers à Kinshasa cherchent des prix usine, un large choix et une livraison fiable. Zandofy relie acheteurs africains et usines internationales, avec un parcours en français et un suivi de commande.</p>
<h2>Ce que couvre Zandofy</h2>
<ul>
<li>Catalogue produits (mode, électronique, maison, beauté…)</li>
<li>Paiement sécurisé sur la plateforme</li>
<li>Chaîne logistique (transitaire, opérateur, livraison locale)</li>
<li>Support client pour l’import Chine → Afrique</li>
</ul>
<h2>Étapes pratiques</h2>
<ol>
<li>Parcourez les <a href="https://zandofy.com/stores">boutiques</a> ou une <a href="https://zandofy.com/category/fashion">catégorie</a>.</li>
<li>Commandez et payez sur Zandofy (évitez les paiements hors plateforme).</li>
<li>Suivez l’acheminement jusqu’à Kinshasa / votre ville desservie.</li>
</ol>
<h2>FAQ</h2>
<p><strong>Puis-je commander sans aller en Chine ?</strong> Oui — l’objectif de la marketplace est de gérer sourcing et logistique pour vous.</p>
<p><strong>Quels délais ?</strong> Selon mode aérien/maritime et préparation vendeur ; le suivi commande indique l’état.</p>
<p><a href="https://zandofy.com/discover">Découvrir Zandofy</a> · <a href="https://zandofy.com/become-vendor">Devenir vendeur</a></p>
$html$,
    admin_id, 'published', true,
    ARRAY['achat en chine','rdc','kinshasa','import'],
    6,
    'Acheter en Chine livré en RDC | Guide Zandofy',
    'Guide pour acheter en Chine et recevoir à Kinshasa : prix usine, marketplace sino-africaine, logistique et suivi Zandofy.',
    ARRAY['achat en chine','livraison kinshasa','import rdc','prix usine'],
    'BlogPosting', now(), now()
  ),
  (
    'Import-export Congo : marketplace vs agent classique',
    'import-export-congo-marketplace',
    'Différences entre agent d’achat / fret et une marketplace pour l’import-export vers le Congo.',
    $html$
<h2>Import-export vers le Congo : le contexte</h2>
<p>L’import-export RDC implique sourcing, négociation, contrôle, transport et distribution locale. Beaucoup passent par un agent ou un transitaire ; une marketplace comme Zandofy centralise catalogue, paiement et suivi.</p>
<h2>Marketplace vs agent</h2>
<ul>
<li><strong>Agent</strong> : sur-mesure, relation humaine, souvent moins de transparence prix.</li>
<li><strong>Marketplace</strong> : prix affichés, panier, messagerie vendeur, historique commandes.</li>
</ul>
<h2>Quand choisir Zandofy</h2>
<p>Idéal pour tester des produits, comparer des vendeurs, et industrialiser des commandes récurrentes vers Kinshasa et la sous-région.</p>
<p><a href="https://zandofy.com/stores">Voir les boutiques</a> · <a href="https://zandofy.com/blog/achat-en-chine-livre-rdc-kinshasa">Guide achat Chine → RDC</a></p>
$html$,
    admin_id, 'published', true,
    ARRAY['import export','congo','marketplace'],
    5,
    'Import-export Congo : marketplace Zandofy',
    'Comprendre l’import-export vers le Congo avec une marketplace : transparence, paiement sécurisé, logistique Afrique.',
    ARRAY['import export congo','marketplace rdc','ecommerce congo'],
    'BlogPosting', now(), now()
  ),
  (
    'Fournisseur fiable Chine → Afrique : critères et bonnes pratiques',
    'fournisseur-fiable-chine-afrique',
    'Comment identifier un fournisseur fiable pour importer vers l’Afrique sans se faire avoir.',
    $html$
<h2>Qu’est-ce qu’un fournisseur fiable ?</h2>
<p>Un fournisseur fiable tient ses délais, décrit correctement le produit, accepte le cadre plateforme, et répond aux messages. Sur Zandofy, les boutiques publiques sont soumises à des règles de visibilité et de modération.</p>
<h2>Signaux à vérifier</h2>
<ul>
<li>Fiche produit complète (photos, description, MOQ, dimensions)</li>
<li>Boutique active et statut public</li>
<li>Communication claire avant commande</li>
<li>Paiement uniquement via la plateforme</li>
</ul>
<h2>Erreurs fréquentes</h2>
<p>Payer hors site, ignorer le poids/volume (fret), ou commander sans vérifier la catégorie et les frais de livraison estimés.</p>
<p><a href="https://zandofy.com/popular">Produits populaires</a> · <a href="https://zandofy.com/help-center">Centre d’aide</a></p>
$html$,
    admin_id, 'published', true,
    ARRAY['fournisseur fiable','chine','afrique'],
    5,
    'Fournisseur fiable Chine → Afrique | Zandofy',
    'Critères pour choisir un fournisseur fiable Chine-Afrique : fiches produit, boutique vérifiée, paiement sécurisé Zandofy.',
    ARRAY['fournisseur fiable','import chine afrique','sourcing'],
    'BlogPosting', now(), now()
  ),
  (
    'Achat en Turquie livré en Afrique : alternative et complément à la Chine',
    'achat-turquie-livraison-afrique',
    'Pourquoi et comment sourcer en Turquie pour le marché africain avec Zandofy.',
    $html$
<h2>Turquie : un sourcing complémentaire</h2>
<p>Textile, accessoires, certains biens de consommation : la Turquie est une alternative ou un complément à la Chine pour les acheteurs en Afrique francophone.</p>
<h2>Avantages possibles</h2>
<ul>
<li>Délais parfois plus courts selon routes</li>
<li>Qualité perçue sur certains segments mode</li>
<li>Diversification des fournisseurs</li>
</ul>
<h2>Sur Zandofy</h2>
<p>Filtrez par origine / boutiques et comparez avec l’offre Chine. Le parcours reste le même : panier, paiement, logistique, suivi.</p>
<p><a href="https://zandofy.com/category/fashion">Catégorie mode</a> · <a href="https://zandofy.com/discover">Découvrir Zandofy</a></p>
$html$,
    admin_id, 'published', true,
    ARRAY['achat turquie','afrique','import'],
    4,
    'Achat Turquie livré en Afrique | Zandofy',
    'Sourcer en Turquie pour l’Afrique : mode, délais, marketplace Zandofy et livraison suivie.',
    ARRAY['achat turquie','import turquie afrique','mode turquie'],
    'BlogPosting', now(), now()
  ),
  (
    'Marketplace sino-africaine : ce que signifie Zandofy',
    'marketplace-sino-africaine-zandofy',
    'Zando For You — première plateforme e-commerce et logistique sino-africaine orientée RDC.',
    $html$
<h2>Une marketplace sino-africaine, concrètement</h2>
<p>Zandofy (« Zando For You », zando = marché à Kinshasa) connecte acheteurs africains et usines / marques internationales. L’enjeu n’est pas seulement le catalogue : c’est la confiance, le paiement et la logistique jusqu’en Afrique.</p>
<h2>Différenciation</h2>
<ul>
<li>Expérience mobile-first en français</li>
<li>Prix usine + estimation logistique</li>
<li>Rôles vendeur, transitaire, opérateur, livreur</li>
</ul>
<h2>Pour aller plus loin</h2>
<p><a href="https://zandofy.com/about">À propos</a> · <a href="https://zandofy.com/blog/achat-en-chine-livre-rdc-kinshasa">Guide Chine → RDC</a> · <a href="https://zandofy.com/become-vendor">Vendre sur Zandofy</a></p>
$html$,
    admin_id, 'published', true,
    ARRAY['marketplace','sino-africaine','zandofy'],
    4,
    'Marketplace sino-africaine Zandofy | Zando For You',
    'Zandofy, marketplace sino-africaine : prix usine, logistique Chine/Turquie → Afrique, focus RDC Kinshasa.',
    ARRAY['marketplace sino-africaine','zandofy','ecommerce afrique'],
    'BlogPosting', now(), now()
  )
  ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    status = 'published',
    featured = EXCLUDED.featured,
    tags = EXCLUDED.tags,
    meta_title = EXCLUDED.meta_title,
    meta_description = EXCLUDED.meta_description,
    seo_keywords = EXCLUDED.seo_keywords,
    published_at = COALESCE(public.blog_posts.published_at, EXCLUDED.published_at),
    updated_at = now();
END $$;
