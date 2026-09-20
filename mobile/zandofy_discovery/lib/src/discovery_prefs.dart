/// Discovery prefs contract — keep in sync with frontend/src/lib/discovery-prefs.ts
library;

class DiscoveryPrefs {
  DiscoveryPrefs({
    this.version = 1,
    this.audience,
    this.interestCategoryIds = const [],
    this.purchaseScope,
    this.receiptMode,
    this.paymentPrefs = const [],
    this.countryCode,
    this.cityId,
    this.completedAt,
    this.skippedAt,
    DateTime? updatedAt,
  }) : updatedAt = updatedAt ?? DateTime.now().toUtc();

  final int version;
  final String? audience; // male|female|both|any
  final List<String> interestCategoryIds;
  final String? purchaseScope; // city|country|any_country
  final String? receiptMode;
  final List<String> paymentPrefs;
  final String? countryCode;
  final String? cityId;
  final String? completedAt;
  final String? skippedAt;
  final DateTime updatedAt;

  bool get hasCompleted => completedAt != null && completedAt!.isNotEmpty;

  Map<String, dynamic> toJson() => {
        'version': version,
        'audience': audience,
        'interest_category_ids': interestCategoryIds,
        'purchase_scope': purchaseScope,
        'receipt_mode': receiptMode,
        'payment_prefs': paymentPrefs,
        'country_code': countryCode,
        'city_id': cityId,
        'completed_at': completedAt,
        'skipped_at': skippedAt,
        'updated_at': updatedAt.toIso8601String(),
      };

  static DiscoveryPrefs fromJson(Map<String, dynamic>? raw) {
    if (raw == null) return DiscoveryPrefs();
    final audience = raw['audience'] as String?;
    final scope = raw['purchase_scope'] as String?;
    final ids = (raw['interest_category_ids'] as List?)
            ?.whereType<String>()
            .where((id) => id.isNotEmpty && id.length <= 64)
            .take(5)
            .toList() ??
        <String>[];
    final cityRaw = raw['city_id'] as String?;
    final cityOk = cityRaw != null &&
        RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
                caseSensitive: false)
            .hasMatch(cityRaw);
    const allowedPay = {'mobile_money', 'card', 'off_platform', 'later'};
    return DiscoveryPrefs(
      version: (raw['version'] as num?)?.toInt() ?? 1,
      audience: const {'male', 'female', 'both', 'any'}.contains(audience)
          ? audience
          : null,
      interestCategoryIds: ids,
      purchaseScope:
          const {'city', 'country', 'any_country'}.contains(scope) ? scope : null,
      receiptMode: raw['receipt_mode'] as String?,
      paymentPrefs: (raw['payment_prefs'] as List?)
              ?.whereType<String>()
              .where(allowedPay.contains)
              .toList() ??
          const [],
      countryCode: (() {
        final c = (raw['country_code'] as String?)?.toUpperCase();
        if (c != null && c.length == 2) return c;
        return null;
      })(),
      cityId: cityOk ? cityRaw : null,
      completedAt: raw['completed_at'] as String?,
      skippedAt: raw['skipped_at'] as String?,
      updatedAt: DateTime.tryParse(raw['updated_at'] as String? ?? '') ??
          DateTime.now().toUtc(),
    );
  }
}
