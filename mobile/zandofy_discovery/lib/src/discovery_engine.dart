/// Minimal feed assembler mirror — ratios match web DISCOVERY_MIX_DEFAULTS.
library;

import 'discovery_prefs.dart';

class DiscoveryMixConfig {
  const DiscoveryMixConfig({
    this.corePct = 65,
    this.explorePct = 25,
    this.neutralPct = 10,
    this.cityPct = 45,
    this.countryWithinCorePct = 20,
    this.rotationHours = 12,
  });

  final int corePct;
  final int explorePct;
  final int neutralPct;
  final int cityPct;
  final int countryWithinCorePct;
  final int rotationHours;
}

class DiscoveryProductLike {
  DiscoveryProductLike({
    required this.id,
    this.categoryId,
    this.genderTarget,
    this.shopType,
    this.originCountry,
    this.storeCityId,
  });

  final String id;
  final String? categoryId;
  final String? genderTarget;
  final String? shopType;
  final String? originCountry;
  final String? storeCityId;
}

int hashSeed(String input) {
  var h = 2166136261;
  for (final c in input.codeUnits) {
    h ^= c;
    h = (h * 16777619) & 0xffffffff;
  }
  return h;
}

int rotationBucket(int rotationHours, {DateTime? now}) {
  final ms = (rotationHours < 1 ? 1 : rotationHours) * 3600 * 1000;
  final t = (now ?? DateTime.now()).millisecondsSinceEpoch;
  return t ~/ ms;
}

/// Thin ranker: prefer audience+interest+local, then rest. Full 65/25/10 parity lives on web;
/// Flutter should call the same surface ids and re-validate with Vitest fixtures.
List<DiscoveryProductLike> assembleDiscoveryFeed(
  List<DiscoveryProductLike> products, {
  required DiscoveryPrefs prefs,
  DiscoveryMixConfig mix = const DiscoveryMixConfig(),
  int take = 24,
  String surface = 'default',
  String seedKey = 'guest',
}) {
  if (products.isEmpty) return const [];
  if (!prefs.hasCompleted) return products.take(take).toList();

  final seed = hashSeed('$seedKey|${rotationBucket(mix.rotationHours)}|$surface');
  final interest = prefs.interestCategoryIds.toSet();
  final audience = prefs.audience;
  final country = prefs.countryCode?.toUpperCase();
  final cityId = prefs.cityId;

  bool matchesAudience(DiscoveryProductLike p) {
    final g = (p.genderTarget ?? '').toLowerCase();
    if (g.isEmpty || g == 'unisex') return false;
    if (audience == null || audience == 'any') return true;
    if (audience == 'both') {
      return ['male', 'homme', 'female', 'femme'].contains(g);
    }
    if (audience == 'male') return g == 'male' || g == 'homme';
    if (audience == 'female') return g == 'female' || g == 'femme';
    return true;
  }

  bool inInterest(DiscoveryProductLike p) =>
      interest.isEmpty || (p.categoryId != null && interest.contains(p.categoryId));

  final core = products.where((p) {
    if (!matchesAudience(p) || !inInterest(p)) return false;
    if (prefs.purchaseScope == 'city' && cityId != null) {
      return p.storeCityId == cityId ||
          ((p.shopType ?? '').toLowerCase() == 'local' &&
              (p.originCountry ?? '').toUpperCase() == country);
    }
    if (prefs.purchaseScope == 'country') {
      return (p.shopType ?? '').toLowerCase() == 'local' &&
          (country == null ||
              (p.originCountry ?? '').toUpperCase() == country);
    }
    return true;
  }).toList();

  // Deterministic-ish order from seed
  core.sort((a, b) => (hashSeed(a.id) ^ seed).compareTo(hashSeed(b.id) ^ seed));
  final rest = products.where((p) => !core.any((c) => c.id == p.id)).toList();
  rest.sort((a, b) => (hashSeed(a.id) ^ seed).compareTo(hashSeed(b.id) ^ seed));

  final out = <DiscoveryProductLike>[...core, ...rest];
  return out.take(take).toList();
}
