import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import ts from 'typescript';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');

// COO 2026-10-23 authorizes these UAT deltas; historical Production goldens stay frozen.
// These admissions never return historical source to runtime/render fixtures.
export const reviewedMasterUatOwners = {
  "apps/web/app/blog/page.tsx": {"before": "29a233316183374446d117aeb0d9fc9ccba52d43055e5552e4f3f80ec550f5ce", "previous": ["29a233316183374446d117aeb0d9fc9ccba52d43055e5552e4f3f80ec550f5ce"], "after": "28a9b279896e190018377b22cddfee3b3276f1a844540d0713ed59d1e00875d1", "reason": "CMS validation/display text or SEO delegation; current schema/render/metadata tests retained"},
  "apps/web/app/ci-planning/page.tsx": {"before": "1bcec72d36fbf2cb3239620f21399ca9192eb259043f8f175bfeaec3a4868048", "previous": ["1bcec72d36fbf2cb3239620f21399ca9192eb259043f8f175bfeaec3a4868048"], "after": "6bdc2925143bda8a2d2d687e69312faa737e2b25618bce6e67f7a4bd28a7462a", "reason": "CMS validation/display text or SEO delegation; current schema/render/metadata tests retained"},
  "apps/web/app/cookie-policy/page.tsx": {"before": "a6925d6982d0251d74542a8c4fdea408082454f243e0f83b52bcec124d767a9a", "previous": ["67daababe7bc9fc1735e985ac8d0d8a59e014f645d772c43e7c16c3e4dcced27", "a6925d6982d0251d74542a8c4fdea408082454f243e0f83b52bcec124d767a9a"], "after": "a540031c7bd3064560244c68f4f6443c6d702d4555b3a44fe83e58e9e4d5fc94", "reason": "CMS text extraction; current default/override render and lane tests"},
  "apps/web/app/layout.tsx": {"before": "610af9138cc5e8af09e2b9dd00dc772ee9b8a189daf83f19b478540b000524e4", "previous": ["610af9138cc5e8af09e2b9dd00dc772ee9b8a189daf83f19b478540b000524e4", "926820a1263ca1b215396cb37dbeda57186f63c38d505d9be4e3dfd9fe19fcc0", "daa07176ae85638c47960e0561fc28da4cef4101fb12f1f73bf10eaccee4b472"], "after": "8f5386d2856faaf786df41662174beb0735cc62d9fce2cd6d82bd2a731575963", "reason": "CMS text extraction; current default/override render and lane tests"},
  "apps/web/app/not-found.tsx": {"before": "d5f055450e92852aaf5e1b5110760a273156a65ef3e274e7b028de56afc6cd57", "previous": ["73fb0bf30b6e8302c1526d9f9ce979147377938026c03f4de2a60d9bb1f31fe8", "d5f055450e92852aaf5e1b5110760a273156a65ef3e274e7b028de56afc6cd57"], "after": "3ebd09b78ab0158fa127ef72b22b913719ecce34bbb7a1cbd324406e8fa95ce2", "reason": "CMS text extraction; current default/override render and lane tests"},
  "apps/web/app/page.tsx": {"before": "078e4f47f6cfdeb924604610b87ac0f8abe51bd1bc064bf33e91f8f5501dd3b7", "previous": ["078e4f47f6cfdeb924604610b87ac0f8abe51bd1bc064bf33e91f8f5501dd3b7", "4a398712e8c7eb60ed5842214a16949e4ee25908d131aba16f3263f414609b56"], "after": "d27642150e79d0dd53b24e0caf6f08f2db1965350ff0b3185a9e8ea21581a5dd", "reason": "CMS text extraction; current default/override render and lane tests"},
  "apps/web/app/play/money-story/page.tsx": {"before": "82d0e4b963086b418224683ae699f51b6b1604e6969f01c297e0b8b521e1f00f", "previous": ["82d0e4b963086b418224683ae699f51b6b1604e6969f01c297e0b8b521e1f00f"], "after": "640a0b7b5b2dc4eb1ef0509b3541cd151478825cd6c32596c1a679545b0844f4", "reason": "CMS validation/display text or SEO delegation; current schema/render/metadata tests retained"},
  "apps/web/app/privacy/page.tsx": {"before": "b33b13f6e96896e52fcbf6183c9c828904f071214ef7bf00c871054553924720", "previous": ["b33b13f6e96896e52fcbf6183c9c828904f071214ef7bf00c871054553924720"], "after": "bbc50c12b8e6e79815c425777d5810d286b9879cc3e46c10f2e2263e040cd14b", "reason": "CMS text extraction; current default/override render and lane tests"},
  "apps/web/app/sitemaps/tools.xml/route.ts": {"before": "d6f0a88e8e082af3045cd5a4b132241444d50164c9293ec36e647087993033f0", "previous": ["d6f0a88e8e082af3045cd5a4b132241444d50164c9293ec36e647087993033f0"], "after": "01987729a8a7c3f2ba827726b0c6a8ca43e2b7717f7160eb6b3d67b1193e989d", "reason": "Investment sitemap gated by explicit Web UAT; Production membership unchanged"},
  "apps/web/app/tools/financial-health-check/page.tsx": {"before": "3e572c982951b4ecea1e5d0786841ff28535f80cfccacb7907de290fd452e396", "previous": ["3e572c982951b4ecea1e5d0786841ff28535f80cfccacb7907de290fd452e396"], "after": "bf33c728cb966ed52d915be88e7135b4909ca645ea7a68f32c72e6c73b022080", "reason": "CMS validation/display text or SEO delegation; current schema/render/metadata tests retained"},
  "components/layout/CookieSettingsButton.tsx": {"before": "3b457fc4ae228c0935b9bbe94899fab994ebec4c66f6b3925085367847433c1d", "previous": ["3b457fc4ae228c0935b9bbe94899fab994ebec4c66f6b3925085367847433c1d"], "after": "d12cf5f3e47cc86918415771d7639f267e13fb6479a96a00de51bfcdbefaee61", "reason": "Reviewed CMS display text, UAT navigation or ten-card pagination; current domain and rendered UI tests required"},
  "components/layout/website-43/Website43.module.css": {"before": "973eed337a31212f28ee1210327773568a8534b6d85142ade317872ac7e49b6d", "previous": ["244b11b3d139756c27d99ad67d43f8eeb20287d68fcc8380b90d521c9837be16", "973eed337a31212f28ee1210327773568a8534b6d85142ade317872ac7e49b6d", "c9b70031cf6fde0b095d2a2031f18988e385927487f0c2c3bc6a251fae418175"], "after": "82f1b42934ac9484a57430326d750e0230374ebac5f2dda665936775f0b57342", "reason": "Approved CI human-led text presentation; orphan CSS audit and current responsive tests"},
  "components/layout/website-43/Website43Navbar.tsx": {"before": "3ec52233fa899aa0792fd7555ee7e4d822cd53d9db1367225b394628254543f3", "previous": ["3ec52233fa899aa0792fd7555ee7e4d822cd53d9db1367225b394628254543f3", "95045bf55ac2040c96d87fcd0f3ec63373fa70c3f2665bc8bb876696b3cbdf4d"], "after": "588b1a58c7320b5ca0861a498880d531a09370e4552677f69c081ed1044e5427", "reason": "CMS text extraction; current default/override render and lane tests"},
  "components/layout/website-43/Website43Shared.tsx": {"before": "45433f4cf955c8705f020303cfefd51acba6fcf5e401654df8f0c1f3379ac8b6", "previous": ["45433f4cf955c8705f020303cfefd51acba6fcf5e401654df8f0c1f3379ac8b6", "a57722530989efb4db5a6f69a9b7d5d37d83a4bee488d2d46655e71e3e0af3e6"], "after": "251fce6c4027ab80995ceae91c56a1809d6d1acaf9c83ef7c0466ebee6643bad", "reason": "CMS text extraction; current default/override render and lane tests"},
  "components/layout/website-43/Website43ToolHero.tsx": {"before": "bfd8593bf862935f0215c1c11c6da2a16c6665c959e80d17c7e521dba3611446", "previous": ["09688e184bac6522038cdd52d6326a86561d389597b2423f57cc2779e4a3ff92", "bfd8593bf862935f0215c1c11c6da2a16c6665c959e80d17c7e521dba3611446"], "after": "feae50f504b9021233dc999a0829240a63fb45cdc12a1ee7605ab79337f58391", "reason": "Approved CI human-led text presentation; orphan CSS audit and current responsive tests"},
  "components/layout/website-43/constants.ts": {"before": "e3d9042f9e7194748ea40cf6316bfadf249a6c14ae0e287cb8f6b80abe1165cf", "previous": ["e3d9042f9e7194748ea40cf6316bfadf249a6c14ae0e287cb8f6b80abe1165cf"], "after": "9ab96a80158f8f19c7f042422889e88869c6f252081ce36fdb4cc0dfb74833ee", "reason": "Reviewed CMS display text, UAT navigation or ten-card pagination; current domain and rendered UI tests required"},
  "components/ui/HumanCalculatorCard.tsx": {"before": "4e8acb7c79693ab5fecb45383355324a808109a7441e55a421b3c63f8b4cf1c4", "previous": ["4e8acb7c79693ab5fecb45383355324a808109a7441e55a421b3c63f8b4cf1c4", "e9cdc963b6436f95b2e082e8fc30f4bac720f860eceb5f2a313efba24b68abb8"], "after": "d3aecec653b8e1ed2e7fa83212e0051804e93e035683b1f9dca30b00f7627720", "reason": "CMS text extraction; current default/override render and lane tests"},
  "components/ui/MoneyComparison.tsx": {"before": "9bd1947f4b087d50c4454ad2dca27a4e8a2136a0e067f79a00c330a6f5c196a3", "previous": ["9bd1947f4b087d50c4454ad2dca27a4e8a2136a0e067f79a00c330a6f5c196a3"], "after": "c6d97332c2154379527ce1da5b62b08a43443a6f337fe40ecee61772e2a314e2", "reason": "Reviewed CMS display text, UAT navigation or ten-card pagination; current domain and rendered UI tests required"},
  "components/ui/health-happy/HealthHappyCountdown.tsx": {"before": "8932c557a75fe8d3a79cc2b65624d6b6cc3f21f090e8f04650f1b24ecb9f1f35", "previous": ["8932c557a75fe8d3a79cc2b65624d6b6cc3f21f090e8f04650f1b24ecb9f1f35"], "after": "a3a4ccca48adf8de309074299ade00f736a3dd0194d40e0c206c69556e8af683", "reason": "CMS validation/display text or SEO delegation; current schema/render/metadata tests retained"},
  "features/analytics/components/CookieConsent.tsx": {"before": "c33b93274de762aaf9a08536de65c6263da761513edab7d11c37f5f22632ec87", "previous": ["c33b93274de762aaf9a08536de65c6263da761513edab7d11c37f5f22632ec87", "c7c458c43944bb286b6852b5490190a287796b896612fa057b534ab035a308eb"], "after": "b15a71c32939a5018f5e4f9405d1e603b797a60a6e20841f5d7a3204045f8048", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/analytics/components/CookieConsentPreferences.tsx": {"before": "bfa0c44d6fd9342349227b69c4a249845d48ab1c49ac321ff7c85d51d4fc09b7", "previous": ["32f51b40b451203abd00eb071dac62b522b5ebbed4ec05da7bd915a5d1785328", "bfa0c44d6fd9342349227b69c4a249845d48ab1c49ac321ff7c85d51d4fc09b7"], "after": "87a273df2dfd8d3ca33a1d52b8a4d0575af0ebfcf5651ad900125934ef3bf5df", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/blog/pages/BlogArchivePage.tsx": {"before": "8e79c488b53718920e07184bb7e65d199ea4d6f2aa3421d48f9b98589bef589c", "previous": ["578680a5329d211ac27bbffbdfd318da05d7a07d08835757f6050ffa3ecaf4c4", "8e79c488b53718920e07184bb7e65d199ea4d6f2aa3421d48f9b98589bef589c"], "after": "cd525b86bf09321ea151ab78e68698121026d3af83899f3cde6c838bb1ba8837", "reason": "CMS copy and required Next page props; named renderer still supports authenticated preview defaults"},
  "features/blog/pages/BlogCategoryPage.tsx": {"before": "1411abf041ec54d8e83d22510b90c923d497f46ec292434d56bdcc8b560e246d", "previous": ["1411abf041ec54d8e83d22510b90c923d497f46ec292434d56bdcc8b560e246d", "8c1b13cd9d0d946e21972da8eab69e096e2f6369f400363bc5d050d0a01c9e6a"], "after": "ca7090a27fb42eea89812cb4efcccb6748e5a7c841b9f0b1a0c4e33582a8fd56", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/blog/website-43/ArticleDetailAccess.tsx": {"before": "a25a584fede138b706ad3b61064b49da3c5ddd443529d6cf89aef015eb547dc1", "previous": ["a25a584fede138b706ad3b61064b49da3c5ddd443529d6cf89aef015eb547dc1"], "after": "8da97bfc4cba49d222ff58a8026d5280d9718b85e7be589955aaf53a7978f7d9", "reason": "Reviewed CMS display text, UAT navigation or ten-card pagination; current domain and rendered UI tests required"},
  "features/blog/website-43/BlogNavigation.ts": {"before": "c978030ce80dce3ada76d3269f098c200b12c581d259fb4d8e6fecd4b8f1ff84", "previous": ["c978030ce80dce3ada76d3269f098c200b12c581d259fb4d8e6fecd4b8f1ff84"], "after": "8ecd81680ae3f733fd1f9ba9b75c1f3f86ca1835a4d2ebbc3b3ca64b9b2ceb4d", "reason": "Reviewed CMS display text, UAT navigation or ten-card pagination; current domain and rendered UI tests required"},
  "features/blog/website-43/Website43Article.tsx": {"before": "3e161d551d7a5c779753fe88193c857cd221209818471a2d1afb8c4f02c65f2c", "previous": ["113c9f6feadcd311e70e4fa50c18d0b10cee66f0a62c3e889eb91c0ee2127e6f", "3e161d551d7a5c779753fe88193c857cd221209818471a2d1afb8c4f02c65f2c", "d6415bfcdee858ba052a3c78077f302463ef1db2ce128cb15257c74653a93bb2"], "after": "e137f8f1da94b370059d2afadf4350954bf1d4b34cca9d9ef91f46ab1992da0b", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/blog/website-43/Website43ArticleBody.tsx": {"before": "051738dd345c7fdee2d740ca2d31020ce697abc3ea22227a05f9559b885454d8", "previous": ["051738dd345c7fdee2d740ca2d31020ce697abc3ea22227a05f9559b885454d8", "a6e73b3fe0e67d728be2e4d26083ae08be17ad4493c31431145b8d74297dba07", "ad18924a3408d029dcb8ec886789415faa6bad1d117cdb87e37811a6f7f6d24e"], "after": "5c1b2b6415fe942d33fdcab11ba6cc810b83526d632e2359baff8f6510adc790", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/blog/website-43/Website43ArticleToc.tsx": {"before": "65441545727b6c1c73080080570106cfc5d283026bb0db875fbf577cdbb66270", "previous": ["2f029b8ee547830d9960c37e792589d90d727861004c3eebde6b6ee3f4c81e4b", "65441545727b6c1c73080080570106cfc5d283026bb0db875fbf577cdbb66270", "9c88a2f091174b0a492d10ae2c1e63ed6bb099aa0fe2ef2bf3d1f6de15cc6f86"], "after": "258d8852bd1e182e58a616df977df0a02a298db2cd30de290ffcc94da35c6cab", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/blog/website-43/Website43Blog.tsx": {"before": "4fab6ca4931b548211cf63917f3ea901c9798ad44e68f51bf1acc3832fdf3bad", "previous": ["13be963ff5e546403617d026ee811b50b6cb7995fa5355d5222f03c995f23c30", "4fab6ca4931b548211cf63917f3ea901c9798ad44e68f51bf1acc3832fdf3bad"], "after": "dfe7e636854da3c671ed23e7ec3cc842f05d0412057dd331c7cd1e54bad9e554", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/blog/website-43/Website43BlogInteractive.tsx": {"before": "c603b2aba35ec8f952bd862d6757b90b9d46b33bbda075a0522e09ac13fc6ec0", "previous": ["229035fb264ee95052543622aee9211f18d4badd314af8accbba72f78b14ad80", "2b2df3fb9e8ae6574094ad56d4b170efa66001e34b80a9a48fa7001128205a52", "c603b2aba35ec8f952bd862d6757b90b9d46b33bbda075a0522e09ac13fc6ec0"], "after": "30b860fda3148b2f80fd7427298432d92b6772f46e590153c8d07db4f039d0f6", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/blog/website-43/blogData.ts": {"before": "76357d5d6162e65b3abf04b602fbed22df475e9590e309860322ee79d6e81dcc", "previous": ["638ad83c50a55ad09816327d22d63447679c417be3dd58e0680c27ef8a6fc886", "76357d5d6162e65b3abf04b602fbed22df475e9590e309860322ee79d6e81dcc"], "after": "f87d52a1e511daa7905667547a18129e93cd83e2971f052cfc074850448f54a1", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/ci-planning/calculator/schemas.ts": {"before": "53965eb168b40043cfc007f96f7ade90344866e177bb828eb5bba6afd8b2bb46", "previous": ["53965eb168b40043cfc007f96f7ade90344866e177bb828eb5bba6afd8b2bb46"], "after": "1ce62138d7c4a0a65e50ccc8bd48296db30f805289ae511210cb88445681f491", "reason": "CMS validation/display text or SEO delegation; current schema/render/metadata tests retained"},
  "features/ci-planning/components/CILandingIntro.tsx": {"before": "634ffdf75d18bfe63a110c3d798b164fe0cbb4410dd56d8845be411e5ff52d0b", "previous": ["634ffdf75d18bfe63a110c3d798b164fe0cbb4410dd56d8845be411e5ff52d0b"], "after": "5f3a300734da2ba22b6ead660050b42b14a42beafcdfe14ad79cc9d8ac12c5c7", "reason": "Reviewed CMS display text, UAT navigation or ten-card pagination; current domain and rendered UI tests required"},
  "features/ci-planning/components/CIWizard.tsx": {"before": "6f529c5234721605ecea12651351f09129f9c79827dc6c8b8173187ca8e2b86f", "previous": ["24e879079fa598f54bd38ec340ee869fecdbd93becf8ef7c4c448f02645aacf9", "6f529c5234721605ecea12651351f09129f9c79827dc6c8b8173187ca8e2b86f"], "after": "e417b1936cd8a725ed0c8ed7f242ef260c2cc75e1b41359472f603346f8a9567", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/ci-planning/components/ResultImageDownloadButton.tsx": {"before": "379c8a552f20b7dea695093758a3b7adb1885ac2605616fcb234070d33499dee", "previous": ["379c8a552f20b7dea695093758a3b7adb1885ac2605616fcb234070d33499dee"], "after": "226124b5d86abf871cc7b3859b40bb989ee18b6a12c0a7f76b78fbc1a8312c22", "reason": "Reviewed CMS display text, UAT navigation or ten-card pagination; current domain and rendered UI tests required"},
  "features/ci-planning/components/result/CIResult.tsx": {"before": "a2caa60d5139289acaf67cb05658b795ab0db05bb7adbc740447289d7169af42", "previous": ["a2caa60d5139289acaf67cb05658b795ab0db05bb7adbc740447289d7169af42"], "after": "360a73930de75633652ddf51d199b05750ea8c2e29f6dace15091c970d485781", "reason": "Reviewed CMS display text, UAT navigation or ten-card pagination; current domain and rendered UI tests required"},
  "features/ci-planning/components/steps/ExpenseObligationsSection.tsx": {"before": "a7c2e89457fba2da585cf9972df44113597023c2ae7bb3de6c82c906639fcd6c", "previous": ["90dcc645ccdb76e59a391be81ed6b1adbbf7c0a6ee7994873a95fd7a850921c6", "a7c2e89457fba2da585cf9972df44113597023c2ae7bb3de6c82c906639fcd6c"], "after": "c6a948547f6a5c831537b43a6bf3d03c791e343d9b27c598663ea5795bd84cd2", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/ci-planning/components/steps/RecoveryReserveSection.tsx": {"before": "8d13ccb26c52c52f1e3429ac181afb58e1d6922232864e5dc143a9cd6c95060b", "previous": ["8d13ccb26c52c52f1e3429ac181afb58e1d6922232864e5dc143a9cd6c95060b", "902ef0276477887a19a61164f8b26e8a0f678580e9e8c79f8dfb8d259a36edcb"], "after": "06bab1623baaec9875c2a409fd7d8a5c69f42dca03b98753d27ec8cdec18de3d", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/ci-planning/components/steps/StepExistingCI.tsx": {"before": "771331fa2749454f1494bbeb1b3be284af044b2a66ea528ff3b71f4c25e89a89", "previous": ["771331fa2749454f1494bbeb1b3be284af044b2a66ea528ff3b71f4c25e89a89"], "after": "bcbcd6d3015095f25850448c7f4e24255d35a8209165500fc60705a0b836ebfd", "reason": "Reviewed CMS display text, UAT navigation or ten-card pagination; current domain and rendered UI tests required"},
  "features/ci-planning/components/steps/StepExpenses.tsx": {"before": "d178d58769cbd134d8414c0625e7083547cc49cca422d7e3665020074976a1a7", "previous": ["d178d58769cbd134d8414c0625e7083547cc49cca422d7e3665020074976a1a7", "db11e93e92511c46bec0a6131b611f7db0132ffe3f23c1e2e0e2cbaa333d6eb2"], "after": "1f96973a0127354fd12a4df9b69de2e44884916c9e04355fe683f3c3e59454a1", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/ci-planning/page.tsx": {"before": "40a9e9759455373cc7a757bcf7e3fc5b369f702f1542d2225f33d1aec68602fb", "previous": ["08f0a48e0311ccf1865aa3265d69d55788ef58dea3734e38d12b5f8336f3cf07", "40a9e9759455373cc7a757bcf7e3fc5b369f702f1542d2225f33d1aec68602fb"], "after": "1fa0c562ac313560440996951c3530fd77bbba1e51e97bcad1525fb8bde890ca", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/ci-planning/result-image.ts": {"before": "477c7e2abb1f71db62b0febae624f85135a97290507d5659ffa3b198e3023889", "previous": ["477c7e2abb1f71db62b0febae624f85135a97290507d5659ffa3b198e3023889"], "after": "dd611b0c01b2bd8358b7df3ee9708009a65fcd4e9b2fe06ef9af3c6c7ca01845", "reason": "Reviewed CMS display text, UAT navigation or ten-card pagination; current domain and rendered UI tests required"},
  "features/financial-health-check/components/ClientFHC.tsx": {"before": "88f007c1e6c33d83bd4befdd69985363609f6c2ddb230861d548cba49c7e0fa2", "previous": ["538f6c88e61caf04056a62a70cb3ae8ebdf940cc3e8750e71f7f22999b0a2644", "88f007c1e6c33d83bd4befdd69985363609f6c2ddb230861d548cba49c7e0fa2"], "after": "60681811cde985b1ff9aa21d9b7c1458ec232ea8b6d5c1ee86217b76733e2b40", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/financial-health-check/components/FHCLandingIntro.tsx": {"before": "8740261ccd02f6bff6da64a83c3ba175ddf3d30bbbc85198fb08c325b05e6b76", "previous": ["8740261ccd02f6bff6da64a83c3ba175ddf3d30bbbc85198fb08c325b05e6b76"], "after": "89e4cd7d636a3c82cbb739dc309752ab9417edebd5189b897ebf1c2b8a65a798", "reason": "Reviewed CMS display text, UAT navigation or ten-card pagination; current domain and rendered UI tests required"},
  "features/financial-health-check/components/FHCLifeResultImageDownloadButton.tsx": {"before": "c49379902076c490d9c94b5200dd7bee32872a6a39837244f2a6e224bb898942", "previous": ["c49379902076c490d9c94b5200dd7bee32872a6a39837244f2a6e224bb898942"], "after": "aaf53c9ce01d2744fbb4645885e34f25a375409811e6233c5fded01d4bd15cb7", "reason": "Reviewed CMS display text, UAT navigation or ten-card pagination; current domain and rendered UI tests required"},
  "features/financial-health-check/components/LifeCoverageWizard.tsx": {"before": "89448a29974ef184232d2a9aa7a47e588cd7b748106a6bd496ae64f2a6f09dd5", "previous": ["89448a29974ef184232d2a9aa7a47e588cd7b748106a6bd496ae64f2a6f09dd5", "e2bcab67d5640ce07aad863894a22432b4b93841acfb9185820f85b29fa6c475"], "after": "eec8919d3e3dafc49265574674fa843e443afa50429244fc6f0fa845439822d4", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/financial-health-check/page.tsx": {"before": "a0647f90fc9b937a31cf0be0121a602f3bfa498594083b3cbe18dca83ec293bd", "previous": ["a0647f90fc9b937a31cf0be0121a602f3bfa498594083b3cbe18dca83ec293bd"], "after": "d06bf0b411649f17abebd52423309c39fdc3e7dbdc18ca444f24240b6aa8ee83", "reason": "Reviewed CMS display text, UAT navigation or ten-card pagination; current domain and rendered UI tests required"},
  "features/home/website-43/Website43Home.tsx": {"before": "dc2a4efb448ab859570a55a53344c9f88007f19e39a6f497d18185c0ffc9f30e", "previous": ["29e746d13d0d6a1af9337298a9c9b4a53d28e9754aeb97397f3ebe7b33f7884f", "dc2a4efb448ab859570a55a53344c9f88007f19e39a6f497d18185c0ffc9f30e"], "after": "f7e90a7c6c9830648c5dcb20e2d73554939accf4bf07453f188085a1f9ff5da3", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/home/website-43/Website43HomeStatic.tsx": {"before": "854a75321d4511223729efc377a581d0f3581838faf37dd12f7b532f88b612d2", "previous": ["65065bd768fdaca339a6c167a37bfbe29721dd5b06f6d19d4b3b5231e4bca564", "854a75321d4511223729efc377a581d0f3581838faf37dd12f7b532f88b612d2"], "after": "0e8d60e981d2a63a0365f4f503008560d7f516a5047b8e37bb3152ada94a3d79", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/home/website-43/homeFaqs.ts": {"before": "82bf76ab9736e28a26544b3f1544650f4467881617a0d3017065d2fc9bd56409", "previous": ["82bf76ab9736e28a26544b3f1544650f4467881617a0d3017065d2fc9bd56409"], "after": "864038283c5f981552d3df15b70344bf36d371d1ffe0995fafb1cf3386039163", "reason": "Home FAQ compatibility delegates central CMS defaults; current Home+schema FAQ tests retained"},
  "features/money-story/components/MoneyStoryGame.tsx": {"before": "1628800ae52abfd0c6b67a636904eb7c717d43058660700aef3bd1a68c8f468d", "previous": ["1628800ae52abfd0c6b67a636904eb7c717d43058660700aef3bd1a68c8f468d", "a735e9063b36d15b9215463ab05a8b359e9f70ec25389456e376552aafdf2997"], "after": "17a605369ea2febcf293f836f8f415d4352bd48d001ce3ca25732ba61194caca", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/money-story/components/MoneyStoryScreens.tsx": {"before": "bd05ee383cf07515b97e679ee79c1de4200d5a1253796aae96399cd62d02c618", "previous": ["bd05ee383cf07515b97e679ee79c1de4200d5a1253796aae96399cd62d02c618", "f0f2b104aff72531d878ea4419de40f0153b0c1a5ba9ebea942a2e69ea357207"], "after": "0f740915eb4bd659af184b0cbc5346718a868abdf238da009f0ea06fd4bdc3c6", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/money-story/components/MoneyStoryStatusSidebar.tsx": {"before": "6ec4b01b4930d5b14d95073a168e2d87e982ae611edb4945d0ff8accf301ec9b", "previous": ["6ec4b01b4930d5b14d95073a168e2d87e982ae611edb4945d0ff8accf301ec9b"], "after": "4b7f99bb075f35e5994ba3ae8cefa565f627bbe2837b7610edb40b716f6a9a74", "reason": "CMS text extraction; current default/override render and lane tests"},
  "features/money-story/page.tsx": {"before": "82f5d5c4e21df8663c7881e7dc7d1793654f84ee7875654ac27f75f98d32b45b", "previous": ["4895d8d1cb72a096a886b548d8af39b7045dbad84838a0db04ea964d4dc241b0", "82f5d5c4e21df8663c7881e7dc7d1793654f84ee7875654ac27f75f98d32b45b"], "after": "e6a841c0a4423248031aa203b4ee883d140f1e26dafc48c5292a15258b86f540", "reason": "CMS text extraction; current default/override render and lane tests"},
  "lib/analytics.ts": {"before": "4176646b29ae2614cc044fef35d9be7cdffe8cfb303c8519f86fe71c148cd90f", "previous": ["4176646b29ae2614cc044fef35d9be7cdffe8cfb303c8519f86fe71c148cd90f", "c0f11e45efed0a8199b947a4bf38364100a9cafb8f969a97ca263d5c387f2f50"], "after": "9b52729cb0a93c9700385b3e33ec10b87c9b520a33fb5d86b07d06d710874c16", "reason": "Add only Investment event/dimension allowlists; consent and sensitive-field tests retained"},
  "lib/content/sanity-schema.ts": {"before": "edeb7ec8ced8ac7d0386308f6ebdd7a77b6e055af6101aa70c2266d5a57a8a33", "previous": ["534563fbf40e51c01ac8b11edf2aca181c5135b876a811b110ffa15f5a77894c", "d205ac196c3247ccc19ec57a358adc088fb59b7befb8798b4f19a2ee9e02d04c", "edeb7ec8ced8ac7d0386308f6ebdd7a77b6e055af6101aa70c2266d5a57a8a33"], "after": "e9d46f665a5f68853b0c1b582bca975d2fcb27368458d5a7f4b782dc57ddbc02", "reason": "Additive signature blocks and actual author identity; original CMS guards and parsers retained"},
  "lib/content/sanity.ts": {"before": "036885be4019b588fa26d7bb6e4d8bd2cb23aa33e6fd6963951af51e0c862117", "previous": ["036885be4019b588fa26d7bb6e4d8bd2cb23aa33e6fd6963951af51e0c862117", "2b670ca67fd7d4124b58b72339fd484639f9a5ba7e1053010b56725ab065646b", "4f5ef60f0f02697f81b2f2d14b7aa2cf8ce0885de92a11eaf774ff70d325bac0"], "after": "3573123bc1fb889f375c1df82a0ce639bad5b0045d6cd85c07eb3f087a003456", "reason": "Additive signature blocks and actual author identity; original CMS guards and parsers retained"},
  "lib/content/types.ts": {"before": "4a4b67507a288a70890bade4d5bdb98a2db5207cc55a9ed94afbbc9a2ebf1c15", "previous": ["29cb83580e33b6df294d3b01e02cfff335f42a68e6eedc09088cb7eac840de52", "4a4b67507a288a70890bade4d5bdb98a2db5207cc55a9ed94afbbc9a2ebf1c15", "c42e29f8f5c00c2baa08df28a8528159255ccc68694390bbc8f2db508a2d4420"], "after": "b71073429caa5b5d5899400ed94187075f5c1770d70200403ebfe81c2c1f4790", "reason": "Additive signature blocks and actual author identity; original CMS guards and parsers retained"},
  "lib/runtime/investment-availability.ts": {"before": "d7dadd956963e82c6efe4dd966a8710c44aed30d325e5f7f246261ffa3bfc3fa", "previous": ["d7dadd956963e82c6efe4dd966a8710c44aed30d325e5f7f246261ffa3bfc3fa"], "after": "d35194a16d58429683b9781650f83f6711f2a72248c23ed76a105c84aac202e3", "reason": "Explicit Web UAT only; Production/admin/unknown lanes denied by runtime tests"},
  "lib/seo/root-metadata.ts": {"before": "2983a29ac19e21bab33d4faa9d9245a3643fa6fdbbd08821463e67233fdee874", "previous": ["2983a29ac19e21bab33d4faa9d9245a3643fa6fdbbd08821463e67233fdee874"], "after": "85d6d0b4bc1e4014119e1381f3f6d5b7f4a98644628740686552ed7d56e75724", "reason": "CMS text extraction; current default/override render and lane tests"},
  "tests/money-story-presentation-parity.test.mjs": {"before": "5ae09487e20eaadd25fe2e8a203aa6fd07d6a60270efb84764f8225ad42ce708", "previous": ["5ae09487e20eaadd25fe2e8a203aa6fd07d6a60270efb84764f8225ad42ce708"], "after": "f08a574534c94c254574eecf5ed4ae59322ccf7dc8c964b3b19b94e99c3d338e", "reason": "CMS text extraction; current default/override render and lane tests"}
};
// Exact mobile follow-up inverses preserve every original Main UAT source identity.
export function canonicalNavigationPredecessor(file, source) {
  const paths = {
    'components/layout/website-43/Website43Navbar.tsx': { blog: 2, 'tools/financial-health-check': 1, 'ci-planning': 1, 'play/money-story': 1 },
    'components/layout/website-43/Website43Shared.tsx': { blog: 1, 'tools/financial-health-check': 2, 'ci-planning': 1, 'play/money-story': 1, privacy: 1, 'cookie-policy': 1 },
    'features/home/website-43/Website43HomeStatic.tsx': { blog: 1, 'tools/financial-health-check': 2, 'ci-planning': 1, privacy: 1, 'cookie-policy': 1 },
    'features/home/website-43/Website43Home.tsx': { blog: 1, 'tools/financial-health-check': 1, 'ci-planning': 1 },
    'features/blog/website-43/Website43Article.tsx': { blog: 1 },
  };
  if (!Object.hasOwn(paths, file)) return source;
  const navbar = file.endsWith('/Website43Navbar.tsx');
  for (const [route, count] of Object.entries(paths[file])) {
    const before = navbar && route !== 'blog' ? 'href: `${BASE}/' + route + '`' : 'href={`${BASE}/' + route + '`}';
    const current = before.replace(route + '`', route + '/`');
    assert.equal(source.split(current).length - 1, count, file + ': exact canonical ' + route + ' links');
    source = source.replaceAll(current, before);
  }
  if (navbar) {
    const current = "pathname === href.replace(/\\/$/, '')";
    assert.equal(source.split(current).length - 1, 3, 'all tool active-state comparisons retain trailing-slash normalization');
    source = source.replaceAll(current, 'pathname === href');
  }
  return source;
}
export function nativeAuthorPredecessor(source) {
  for (const [current, old] of [
    ['import { cache } from "react";\n', ''],
    ['export const getPrimaryAuthorProfile = cache(unstable_cache(\n  () => readPrimaryAuthorProfile(),', 'export const getPrimaryAuthorProfile = unstable_cache(\n  readPrimaryAuthorProfile,'],
    ['{ revalidate: 300, tags: ["ccpun-primary-author"] },\n));', '{ revalidate: 300, tags: ["ccpun-primary-author"] },\n);'],
    ['async function readPrimaryAuthorProfile(perspective: "published" | "drafts" = "published")', 'async function readPrimaryAuthorProfile()'],
    ['sanityFetch({ query: primaryAuthorQuery, perspective, stega: false })', 'sanityFetch({ query: primaryAuthorQuery, perspective: "published", stega: false })'],
    ['\nexport async function getPrimaryAuthorPreviewProfile() {\n  getSanityPreviewClient();\n  return readPrimaryAuthorProfile("drafts");\n}\n', ''],
  ]) {
    assert.equal(source.split(current).length, 2, 'one exact native author request-cache/guarded-preview delta');
    source = source.replace(current, old);
  }
  return source;
}

export function hasReviewedMasterUatOwner(file) { return Object.hasOwn(reviewedMasterUatOwners, file); }
export function assertReviewedMasterUatOwner(file, previousDigest, source = read(file)) {
  const record = reviewedMasterUatOwners[file];
  assert.ok(record && Object.hasOwn(reviewedMasterUatOwners, file), file + ': not an approved UAT delta');
  assert.ok(record.previous.includes(previousDigest), file + ': historical protected digest changed');
  source = canonicalNavigationPredecessor(file, source);
  if (file === 'lib/content/sanity.ts') source = nativeAuthorPredecessor(source);
  // Invert only the owner-requested removal of the public AI consumer. Keep all
  // prior hashes frozen; this projection is never returned to runtime fixtures.
  const backendOnly = {
    'apps/web/app/blog/page.tsx': [
      ['  return renderBlogPage(props);\n', '  if (process.env.CCPUN_APP_ENV === "web-uat" || process.env.CCPUN_APP_ENV === "local-uat") {\n    const { CCPunAiSearchBar } = await import("@/features/ai-search/CCPunAiSearchWidgets");\n    return renderBlogPage({ ...props, searchEnhancement: <CCPunAiSearchBar /> });\n  }\n  return renderBlogPage(props);\n'],
    ],
    'features/blog/pages/BlogArchivePage.tsx': [
      ['import type { Metadata } from "next";\n', 'import type { Metadata } from "next";\nimport type { ReactNode } from "react";\n'],
      ['type BlogPageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };', 'type BlogPageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>>; searchEnhancement?: ReactNode };'],
      ['renderBlogPage({ searchParams }: BlogPageProps', 'renderBlogPage({ searchParams, searchEnhancement }: BlogPageProps'],
      ['      siteCopyOverride={siteCopyOverride}\n', '      siteCopyOverride={siteCopyOverride}\n      searchEnhancement={searchEnhancement}\n'],
    ],
    'features/blog/website-43/Website43Blog.tsx': [
      ['topicNavigation, siteCopyOverride }: {', 'topicNavigation, siteCopyOverride, searchEnhancement }: {'],
      ['  siteCopyOverride?: PublicCopyValues;\n', '  siteCopyOverride?: PublicCopyValues;\n  searchEnhancement?: ReactNode;\n'],
      ['        {topicContent}\n', '        {topicContent}\n        {searchEnhancement && <div className={styles.inner}>{searchEnhancement}</div>}\n'],
    ],
  };
  for (const [current, previous] of backendOnly[file] ?? []) {
    assert.equal(source.split(current).length, 2, file + ': exactly one backend-only transition');
    source = source.replace(current, previous);
  }
  if (file === 'components/ui/health-happy/HealthHappyCountdown.tsx') {
    const additions = [
      "import { preload } from 'react-dom';\n",
      "import countdownArtwork from '@/public/assets/blog-migration/aia-health-happy-describe/featured-01-AIA-Health-Happy-article.lossless.webp';\n",
      "  if (placement === 'blog') {\n    preload(countdownArtwork.src, { as: 'image', fetchPriority: 'high' });\n  }\n",
    ];
    for (const addition of additions) {
      assert.equal(source.split(addition).length, 2, 'exact Main Blog-only preload transition');
      source = source.replace(addition, '');
    }
  }
  assert.equal(sha(source), record.after, file + ': unreviewed UAT source drift');
  return true;
}

const controllerPath = 'features/money-story/components/MoneyStoryGame.tsx';
const ownerPath = 'features/money-story/components/MoneyStoryStatusSidebar.tsx';
const parse = (path, source) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const statementName = node => ts.isVariableStatement(node) ? node.declarationList.declarations[0].name.getText() : node.name?.getText();
const find = (tree, predicate) => {
  let found;
  const visit = node => { if (predicate(node)) found ??= node; ts.forEachChild(node, visit); };
  visit(tree);
  assert(found, 'Missing actual implementation node');
  return found;
};
function structure(node, options = {}) {
  if (options.ignoreExport && node.kind === ts.SyntaxKind.ExportKeyword) return null;
  if (ts.isJsxText(node) && !node.text.trim()) return null;
  if (options.omitProtectionTypes && ts.isVariableStatement(node) && statementName(node) === 'protectionTypes') return null;
  if (options.sidebar && ts.isJsxSelfClosingElement(node) && node.tagName.getText() === 'MoneyStoryStatusSidebar') return structure(options.sidebar);
  const children = [];
  ts.forEachChild(node, child => { const value = structure(child, options); if (value !== null) children.push(value); });
  return [node.kind, typeof node.operator === 'number' ? node.operator : null, ts.isVariableDeclarationList(node) ? node.flags : null, typeof node.text === 'string' ? node.text : null, children];
}
function imports(tree) {
  return tree.statements.filter(ts.isImportDeclaration).map(node => ({
    module: node.moduleSpecifier.text,
    typeOnly: Boolean(node.importClause?.isTypeOnly),
    default: node.importClause?.name?.text ?? null,
    namespace: node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings) ? node.importClause.namedBindings.name.text : null,
    bindings: node.importClause?.namedBindings?.elements?.map(item => [item.propertyName?.text ?? item.name.text, item.name.text, Boolean(item.isTypeOnly)]) ?? [],
  }));
}

export function reviewedArticleCardProjection(file, source) {
  const changes = {
  "features/blog/website-43/Website43Article.tsx": [
    [
      "            <p className={styles.articleHeaderMeta} style={{ width: 'min(1028px,100%)', margin: '24px auto 0' }}>โดย {author.name.replaceAll('™', '')}</p>\n",
      ""
    ],
    [
      "textWrap: 'balance', marginTop: 12",
      "textWrap: 'balance'"
    ]
  ],
  "features/blog/website-43/Website43BlogInteractive.tsx": [
    [
      "import ArticleCardEngagement from './ArticleCardEngagement';\nimport cardStyles from './ArticleCardEngagement.module.css';\n",
      ""
    ],
    [
      "    <article className={classNames.articleCard}>\n    <Link className={cardStyles.contentLink} href={article.href}>",
      "    <Link className={classNames.articleCard} href={article.href}>"
    ],
    [
      "      </div>\n    </Link>\n    <ArticleCardEngagement articleId={article.id} title={article.title} dateLabel={article.meta} publishedAt={article.publishedAt} />\n    </article>",
      "        <p className={classNames.articleMeta}>{article.meta}</p>\n      </div>\n    </Link>"
    ]
  ],
  "features/blog/website-43/Website43ArticleBody.tsx": [
    [
      "  const introEnd = items.findIndex(item => item.type !== 'paragraph');\n",
      ""
    ],
    [
      "<p key={key} style={index < (introEnd < 0 ? items.length : introEnd) ? { fontSize: 19, lineHeight: 1.75, color: 'rgba(250,249,249,.9)' } : undefined}>",
      "<p key={key}>"
    ]
  ],
  "features/blog/website-43/blogData.ts": [
    [
      "  id: string;\n",
      ""
    ],
    [
      "    id: article.id,\n",
      ""
    ]
  ]
};
  for (const [reviewed, original] of changes[file] ?? []) {
    assert.equal(source.split(reviewed).length, 2, file + ": one exact approved card/byline/intro change");
    source = source.replace(reviewed, original);
  }
  return source;
}

export function reviewedThaiWrapProjection(file, source) {
  const additions = {
  "features/blog/website-43/Website43Article.tsx": [
    [
      "<h1 className={styles.articleHeadline}>",
      "<h1 className={styles.articleHeadline} style={{ textWrap: 'balance' }}>"
    ],
    [
      "<h3 className={styles.articleTitle}>",
      "<h3 className={styles.articleTitle} style={{ textWrap: 'pretty' }}>"
    ],
    [
      "<p className={styles.articleExcerpt}>",
      "<p className={styles.articleExcerpt} style={{ textWrap: 'pretty' }}>"
    ]
  ],
  "features/blog/website-43/Website43BlogInteractive.tsx": [
    [
      "<h2 className={classNames.articleTitle}>",
      "<h2 className={classNames.articleTitle} style={{ textWrap: 'pretty' }}>"
    ],
    [
      "<p className={classNames.articleExcerpt}>",
      "<p className={classNames.articleExcerpt} style={{ textWrap: 'balance' }}>"
    ]
  ],
  "features/blog/website-43/Website43ArticleToc.tsx": [
    [
      "data-level={group.primary.level}>",
      "data-level={group.primary.level} style={{ textWrap: 'pretty' }}>"
    ],
    [
      "data-level={heading.level}>",
      "data-level={heading.level} style={{ textWrap: 'pretty' }}>"
    ]
  ]
};
  for (const [original, reviewed] of additions[file] ?? []) {
    assert.equal(source.split(reviewed).length, 2, file + ": one exact scoped Thai wrapping insertion");
    source = source.replace(reviewed, original);
  }
  return source;
}

export function articleOverviewSourceProjection(source) {
  for (const addition of [
    "import Website43ArticleOverview from './Website43ArticleOverview';\n",
    "              {(preview || article.status === 'published') && <Website43ArticleOverview summary={article.geo?.summary} />}\n",
  ]) {
    assert.equal(source.split(addition).length, 2, 'one exact approved published overview insertion');
    source = source.replace(addition, '');
  }
  return source;
}

export function assertReviewedUxOwners(proof, allowed, readCurrent = read) {
  assert.deepEqual(Object.keys(proof.reviewedUxOwners).sort(), [...allowed].sort(), 'Only exact reviewed UI owners are admitted');
  for (const file of allowed) {
    const admission = proof.reviewedUxOwners[file];
    assert.deepEqual(Object.keys(admission).sort(), ['baselineSha256','candidateSha256']);
    assert.equal(admission.baselineSha256, (proof.protected[file] ?? proof.canonical?.[file]), file + ': original protected digest retained');
    assert.match(admission.candidateSha256, /^[0-9a-f]{64}$/);
    if (hasReviewedMasterUatOwner(file)) {
      assertReviewedMasterUatOwner(file, admission.candidateSha256, readCurrent(file));
      continue; // This explicitly changed UAT UI is covered by current render tests, not old byte parity.
    }
    let source = reviewedThaiWrapProjection(file, reviewedArticleCardProjection(file, readCurrent(file)));
    if (file === 'features/blog/website-43/Website43Article.tsx') source = articleOverviewSourceProjection(source);
    let expected = admission.candidateSha256;
    const articleV4 = {
      'components/layout/website-43/Website43.module.css': ['244b11b3d139756c27d99ad67d43f8eeb20287d68fcc8380b90d521c9837be16', 'def909c954d9bd9769e26ba4bac4c2c16de40719affce6668b486423853dbf13'],
      'features/blog/website-43/Website43Article.tsx': ['d6415bfcdee858ba052a3c78077f302463ef1db2ce128cb15257c74653a93bb2', 'c808e31c1e6e43e6c8ca7bb2b41efe7c82c36c696c1b0a1ee0eb6363dfaea3ae'],
    };
    if (articleV4[file]) {
      assert.equal(expected, articleV4[file][0], file + ': previous reviewed candidate retained');
      expected = articleV4[file][1];
    }
    const unusedLegalCss = {
      'components/layout/website-43/Website43.module.css': ['def909c954d9bd9769e26ba4bac4c2c16de40719affce6668b486423853dbf13', '973eed337a31212f28ee1210327773568a8534b6d85142ade317872ac7e49b6d'],
      'components/layout/website-43/Website43ResponsiveStyles.tsx': ['6c90a2136905c48703e1d68108d2bb3fa5d21d8bee64bf25bb4737274c2ed3bb', '49a2b4550755fc02c7c1f145bb5980b267c6a2d82013059cc135cd4ad6464717'],
    };
    if (unusedLegalCss[file]) {
      assert.equal(expected, unusedLegalCss[file][0], file + ': pre-cleanup source retained');
      expected = unusedLegalCss[file][1];
    }
    if (file === 'apps/web/app/layout.tsx') {
      const approved = 'weight: ["300", "400", "500", "600", "700"]';
      assert.equal(source.split(approved).length, 2, 'one noncritical Kanit 500 face');
      source = source.replace(approved, 'weight: ["300", "400", "600", "700"]');
      const critical = 'weight: ["400", "500", "600", "700"]';
      assert.equal(source.split(critical).length, 2, 'one critical Thai Kanit 500 face');
      source = source.replace(critical, 'weight: ["400", "600", "700"]');
      assert.equal(source.split('display: "swap"').length, 3, 'both existing Kanit loaders swap late fonts');
      source = source.replaceAll('display: "swap"', 'display: "optional"');
    }
    const additions = {
      'lib/content/types.ts': ['  optimizedAt?: string;\n'],
      'lib/content/sanity-schema.ts': ['  contentOptimizedAt: z.string().datetime({ offset: true }).nullish().transform((value) => value ?? undefined).catch(undefined),\n'],
      'lib/content/sanity.ts': ['    optimizedAt: raw.contentOptimizedAt,\n', '  contentOptimizedAt,\n'],
    };
    for (const addition of additions[file] ?? []) {
      assert.equal(source.split(addition).length, 2, file + ': one explicit optimization-date addition');
      source = source.replace(addition, '');
    }
    assert.equal(sha(source), expected, file + ': current reviewed source frozen');
  }
}

const approvedResetGuard = "if (game?.status === 'active' && (game.currentMonth > 1 || game.history.length > 0) && !window.confirm('กลับไปเลือกตัวละครจะเริ่มรอบใหม่ ต้องการเริ่มใหม่หรือไม่?')) return;";
function resetPresentationProjection(source) {
  const tree = parse(controllerPath, source);
  const reset = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'returnToCharacterSelection');
  assert(ts.isArrowFunction(reset.initializer) && ts.isBlock(reset.initializer.body));
  const guard = reset.initializer.body.statements[0];
  assert(ts.isIfStatement(guard), 'Reset prompt must be the first statement before events/state changes');
  assert.equal(guard.getText(tree), approvedResetGuard, 'Only the exact approved native reset guard is admitted');
  return source.slice(0, guard.getStart(tree)) + source.slice(guard.end);
}

// Explicit admission to the OLD protected-manifest assertion. No original source
// is returned; current-source readers continue reading current implementations.
export function assertPhase2MoneyComposition(file, expectedBaselineDigest, readCurrent = read) {
  assert.equal(file, controllerPath, 'Only the reviewed Money Story composition is admitted');
  const proof = JSON.parse(readCurrent('qa/phase2-css-delivery-parity.json'));
  const composition = proof.moneyComposition;
  assert.equal(composition.controller, controllerPath);
  assert.equal(composition.owner, ownerPath);
  const current = readCurrent(file), owner = readCurrent(ownerPath);
  if (hasReviewedMasterUatOwner(file)) {
    assertReviewedMasterUatOwner(file, expectedBaselineDigest, current);
    assertReviewedMasterUatOwner(ownerPath, composition.ownerSha256, owner);
    assertReviewedMasterUatOwner(composition.test, composition.outputTestSha256, readCurrent(composition.test));
    const original = gunzipSync(Buffer.from(proof.moneyOriginalControllerGzip, 'base64')).toString();
    assert.equal(sha(original), expectedBaselineDigest, 'Frozen original Money Story source retained');
    assert.equal(sha(original), composition.baselineSha256);
    return true; // Actual current JSX/actions and all 18 historical game goldens run in the registered test.
  }
  assert.equal(sha(current), composition.controllerSha256, 'Unreviewed controller composition');
  assert.equal(sha(owner), composition.ownerSha256, 'Unreviewed current sidebar body');
  const original = gunzipSync(Buffer.from(proof.moneyOriginalControllerGzip, 'base64')).toString();
  assert.equal(sha(original), expectedBaselineDigest, 'Original f703 output fixture must match the unchanged protected manifest');
  assert.equal(sha(original), composition.baselineSha256);
  assert.equal(composition.test, 'tests/money-story-presentation-parity.test.mjs');
  assert.equal(sha(readCurrent(composition.test)), composition.outputTestSha256, 'Actual output/action test drift');
  const oldTree = parse(file, original), currentTree = parse(file, resetPresentationProjection(current)), ownerTree = parse(ownerPath, owner);
  const expectedImports = imports(oldTree).map(item => ({ ...item, bindings: item.bindings.filter(([imported, local]) => !['Car', 'HeartPulse', 'House', 'ShieldCheck', 'Users'].includes(imported) || imported !== local) }));
  expectedImports.push({ module: './MoneyStoryStatusSidebar', typeOnly: false, default: null, namespace: null, bindings: ['money', 'MoneyStoryStatusSidebar', 'percentLabel'].map(name => [name, name, false]) });
  assert.deepEqual(imports(currentTree), expectedImports, 'Only presentation bindings may move');
  assert.doesNotMatch(owner, /\b(?:useState|useEffect|trackEvent|trackMoneyStoryEvent|setGame)\b/);
  assert(!imports(ownerTree).some(item => item.module.includes('MoneyStoryGame')), 'No owner/controller cycle');
  const oldFunction = find(oldTree, node => ts.isFunctionDeclaration(node) && node.name?.text === 'MoneyStoryGame');
  const ownerFunction = find(ownerTree, node => ts.isFunctionDeclaration(node) && node.name?.text === 'MoneyStoryStatusSidebar');
  for (const node of ownerTree.statements.filter(ts.isImportDeclaration)) {
    assert(!node.importClause?.namedBindings || ts.isNamedImports(node.importClause.namedBindings));
    assert(node.importClause?.namedBindings?.elements?.every(item => !item.propertyName) ?? true, 'No presentation import alias may change its original binding');
  }
  assert.deepEqual(imports(ownerTree), [
    { module: 'lucide-react', typeOnly: false, default: null, namespace: null, bindings: ['Car', 'HeartPulse', 'House', 'ShieldCheck', 'Users'].map(name => [name, name, false]) },
    { module: '../config', typeOnly: false, default: null, namespace: null, bindings: ['PROTECTION_CATALOG'].map(name => [name, name, false]) },
    { module: '../engine', typeOnly: true, default: null, namespace: null, bindings: ['statusBars'].map(name => [name, name, false]) },
    { module: '../types', typeOnly: true, default: null, namespace: null, bindings: ['GameState', 'ProtectionType'].map(name => [name, name, false]) },
    { module: '../MoneyStory.module.css', typeOnly: false, default: 'styles', namespace: null, bindings: [] },
  ], 'Only original presentation dependencies and type-only state contracts belong to the sidebar');
  assert.deepEqual(ownerTree.statements.filter(node => !ts.isImportDeclaration(node)).map(statementName),
    ['money', 'protectionIcons', 'Meter', 'percentLabel', 'MoneyStoryStatusSidebarProps', 'MoneyStoryStatusSidebar'],
    'No extra top-level initialization or side-effect statements');
  assert(ownerTree.statements.every(node => ts.isImportDeclaration(node) || ts.isVariableStatement(node)
    || ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node)));
  assert.deepEqual(ownerFunction.modifiers?.map(node => node.kind), [ts.SyntaxKind.ExportKeyword]);
  assert.equal(ownerFunction.parameters.length, 1);
  assert.equal(ownerFunction.parameters[0].type?.getText(), 'MoneyStoryStatusSidebarProps');
  assert(!ownerFunction.parameters[0].initializer && !ownerFunction.parameters[0].dotDotDotToken);
  const bindings = ownerFunction.parameters[0].name;
  assert(ts.isObjectBindingPattern(bindings));
  assert.deepEqual(bindings.elements.map(binding => [binding.name.getText(), binding.propertyName?.getText(), Boolean(binding.initializer)]),
    [['game', undefined, false], ['bars', undefined, false]], 'Actual state/status props remain correctly bound');
  assert.deepEqual(ownerFunction.body.statements.map(node => node.kind),
    [ts.SyntaxKind.VariableStatement, ts.SyntaxKind.ReturnStatement], 'No hidden owner mutations or calls before the view');

  const ownerReturn = find(ownerFunction, node => ts.isReturnStatement(node)).expression;
  const returnedAside = ts.isParenthesizedExpression(ownerReturn) ? ownerReturn.expression : ownerReturn;
  const sidebarCall = find(currentTree, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText() === 'MoneyStoryStatusSidebar');
  assert.equal(sidebarCall.getText(), '<MoneyStoryStatusSidebar game={game} bars={bars} />');
  const oldTypes = find(oldFunction, node => ts.isVariableStatement(node) && statementName(node) === 'protectionTypes');
  const currentTypes = find(ownerFunction, node => ts.isVariableStatement(node) && statementName(node) === 'protectionTypes');
  assert.deepEqual(structure(currentTypes), structure(oldTypes));
  for (const name of ['money', 'protectionIcons', 'Meter', 'percentLabel']) {
    const oldNode = oldTree.statements.find(node => statementName(node) === name);
    const newNode = ownerTree.statements.find(node => statementName(node) === name);
    assert(oldNode && newNode, name);
    assert.deepEqual(structure(newNode, { ignoreExport: true }), structure(oldNode), name + ': moved helper body');
  }
  const moved = new Set(['money', 'protectionIcons', 'Meter', 'percentLabel']);
  const keep = node => !ts.isImportDeclaration(node) && !moved.has(statementName(node));
  assert.deepEqual(currentTree.statements.filter(keep).map(node => structure(node, { sidebar: returnedAside })),
    oldTree.statements.filter(keep).map(node => structure(node, { omitProtectionTypes: true })), 'Remaining controller logic and expanded CURRENT sidebar must match f703');
  return true;
}
