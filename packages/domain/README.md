# @cvb/domain

Business rules with no framework, database or UI: the CV model (`CV`, `emptyCV`, `normalizeCV`, `sampleCV`), quality checks (`cvChecks`, `cvStrength`, `stepState`) and plans (`PLANS`, `FEATURES`, `can`, `LIMITS`, `canUseTemplateTier`). Imported by web, api and worker so every surface applies the same rules. Depends only on `@cvb/shared`.
