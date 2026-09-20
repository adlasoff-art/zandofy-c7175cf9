import 'package:test/test.dart';
import 'package:zandofy_discovery/zandofy_discovery.dart';

void main() {
  test('fromJson normalizes audience and city', () {
    final p = DiscoveryPrefs.fromJson({
      'audience': 'male',
      'interest_category_ids': ['a', 'b'],
      'purchase_scope': 'city',
      'country_code': 'cd',
      'city_id': '11111111-1111-4111-8111-111111111111',
      'completed_at': '2026-01-01T00:00:00.000Z',
    });
    expect(p.audience, 'male');
    expect(p.countryCode, 'CD');
    expect(p.hasCompleted, isTrue);
  });

  test('assemble returns take without completed', () {
    final pool = List.generate(
      5,
      (i) => DiscoveryProductLike(id: '$i', genderTarget: 'male'),
    );
    final ranked = assembleDiscoveryFeed(
      pool,
      prefs: DiscoveryPrefs(),
      take: 3,
    );
    expect(ranked.length, 3);
  });
}
