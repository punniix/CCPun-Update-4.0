import { eyebrowPredecessor } from "./v5-eyebrow-proof.mjs";
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { moneyStoryDockPredecessor } from './v5-money-story-dock-proof.mjs';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { cookieBannerTimingPredecessor } from './v5-cookie-banner-timing-proof.mjs';
import { loadFixtureModule } from './phase1-fixture-loader.mjs';
import { adminPhase1PredecessorDigest } from './admin-phase1-quick-wins-proof.mjs';
import { isWebsiteV5RetainedSource, isWebsiteV5ReviewedSuccessor, websiteV5CopyPredecessor, websiteV5InvestmentCopyPredecessor, websiteV5RendererSources } from './website-v5-phase-a-proof.mjs';

// Exact b871b734 -> 05370957 same-word CMS capability admission. Historical
// manifests and rendered/metadata/action goldens are deliberately unchanged.
export const productionCmsOwners = {
  "app/blog/page.tsx": {"before":"29a233316183374446d117aeb0d9fc9ccba52d43055e5552e4f3f80ec550f5ce","after":"5d5369826ed9b777a2bdfd2148d68aa651166a847a648cd8c03ba4f65ca2dc7b"},
  "app/ci-planning/page.tsx": {"before":"1bcec72d36fbf2cb3239620f21399ca9192eb259043f8f175bfeaec3a4868048","after":"a144f0e0014c1f80c22cdb2c5d4bba5ba792d91537eb4916616ac0fbace89c46"},
  "app/cookie-policy/page.tsx": {"before":"a3f4b5b3609ddf78b8fe68a59e27ac84a0d42e06a7c10bf3dc403ce2925cef5e","after":"abffccc4056f030a14b11b66c52a4eeafa63138cea89530914e489ffcccd4260"},
  "app/page.tsx": {"before":"814c4f422df23d52812e47838606bfd339417cf7e80ead1854af453e8c8cfec9","after":"07eee1ba31bc5148b9b88e6d038707ee9a2c429e560868acff679bc0e84b05f8"},
  "app/play/money-story/page.tsx": {"before":"82d0e4b963086b418224683ae699f51b6b1604e6969f01c297e0b8b521e1f00f","after":"6358b89ed65eb9bce0a020775e07a58c3c6ec8e79118a5637a25b1ce7d4b6d8a"},
  "app/privacy/page.tsx": {"before":"0a8a39afe17526e021fcb2a8e39ca4020b353f1f2e56f9940e9bee0c7d3e142c","after":"aefa7269d4f2dd8c68c4f18fad0d303ce46e9eb43c31f25af651f059c4b206a9"},
  "app/tools/financial-health-check/page.tsx": {"before":"3e572c982951b4ecea1e5d0786841ff28535f80cfccacb7907de290fd452e396","after":"14613344a5fc7329a958c3372141570e273755b7ae7f8cf9c42685e0736e0824"},
  "apps/web/app/blog/page.tsx": {"before":"29a233316183374446d117aeb0d9fc9ccba52d43055e5552e4f3f80ec550f5ce","after":"2f83cf6c2d436b2f6abbc2d3dec7d4ed345cf698c30fd5e4b1f1ea1beb6f611c"},
  "apps/web/app/ci-planning/page.tsx": {"before":"1bcec72d36fbf2cb3239620f21399ca9192eb259043f8f175bfeaec3a4868048","after":"6bdc2925143bda8a2d2d687e69312faa737e2b25618bce6e67f7a4bd28a7462a"},
  "apps/web/app/cookie-policy/page.tsx": {"before":"a6925d6982d0251d74542a8c4fdea408082454f243e0f83b52bcec124d767a9a","after":"a540031c7bd3064560244c68f4f6443c6d702d4555b3a44fe83e58e9e4d5fc94"},
  "apps/web/app/layout.tsx": {"before":"610af9138cc5e8af09e2b9dd00dc772ee9b8a189daf83f19b478540b000524e4","after":"8f5386d2856faaf786df41662174beb0735cc62d9fce2cd6d82bd2a731575963"},
  "apps/web/app/not-found.tsx": {"before":"d5f055450e92852aaf5e1b5110760a273156a65ef3e274e7b028de56afc6cd57","after":"3ebd09b78ab0158fa127ef72b22b913719ecce34bbb7a1cbd324406e8fa95ce2"},
  "apps/web/app/page.tsx": {"before":"078e4f47f6cfdeb924604610b87ac0f8abe51bd1bc064bf33e91f8f5501dd3b7","after":"f632926c278790246480321d2aacf80b29b10f1ada4952b2b54944e9d3f8f8c9"},
  "apps/web/app/play/money-story/page.tsx": {"before":"82d0e4b963086b418224683ae699f51b6b1604e6969f01c297e0b8b521e1f00f","after":"640a0b7b5b2dc4eb1ef0509b3541cd151478825cd6c32596c1a679545b0844f4"},
  "apps/web/app/privacy/page.tsx": {"before":"b33b13f6e96896e52fcbf6183c9c828904f071214ef7bf00c871054553924720","after":"bbc50c12b8e6e79815c425777d5810d286b9879cc3e46c10f2e2263e040cd14b"},
  "apps/web/app/tools/financial-health-check/page.tsx": {"before":"3e572c982951b4ecea1e5d0786841ff28535f80cfccacb7907de290fd452e396","after":"bf33c728cb966ed52d915be88e7135b4909ca645ea7a68f32c72e6c73b022080"},
  "components/layout/CookieSettingsButton.tsx": {"before":"3b457fc4ae228c0935b9bbe94899fab994ebec4c66f6b3925085367847433c1d","after":"d12cf5f3e47cc86918415771d7639f267e13fb6479a96a00de51bfcdbefaee61"},
  "components/layout/website-43/Website43Navbar.tsx": {"before":"3ec52233fa899aa0792fd7555ee7e4d822cd53d9db1367225b394628254543f3","after":"527ceb74bdcfd5abe993747c7f268232186ccd98c98d40bbf7fe042a64fa43f0"},
  "components/layout/website-43/Website43Shared.tsx": {"before":"45433f4cf955c8705f020303cfefd51acba6fcf5e401654df8f0c1f3379ac8b6","after":"a76c4f5106c847380a9f1e446ddd068b2aafb2f577dee9f1b7011a233c0c6dfa"},
  "components/ui/HumanCalculatorCard.tsx": {"before":"4e8acb7c79693ab5fecb45383355324a808109a7441e55a421b3c63f8b4cf1c4","after":"d3aecec653b8e1ed2e7fa83212e0051804e93e035683b1f9dca30b00f7627720"},
  "components/ui/MoneyComparison.tsx": {"before":"9bd1947f4b087d50c4454ad2dca27a4e8a2136a0e067f79a00c330a6f5c196a3","after":"c6d97332c2154379527ce1da5b62b08a43443a6f337fe40ecee61772e2a314e2"},
  "components/ui/PublicCopyProvider.tsx": {"before":null,"after":"565e5900c54e34425b9b4ddf990c91c6cabd135157d021a791c2a006324b9088"},
  "components/ui/health-happy/HealthHappyCountdown.tsx": {"before":"8932c557a75fe8d3a79cc2b65624d6b6cc3f21f090e8f04650f1b24ecb9f1f35","after":"c62dfa03e7d793301a1df01eb9e02563ca408a559d72e43f97da85834e20bbd7"},
  "features/analytics/components/CookieConsent.tsx": {"before":"c33b93274de762aaf9a08536de65c6263da761513edab7d11c37f5f22632ec87","after":"b15a71c32939a5018f5e4f9405d1e603b797a60a6e20841f5d7a3204045f8048"},
  "features/analytics/components/CookieConsentPreferences.tsx": {"before":"bfa0c44d6fd9342349227b69c4a249845d48ab1c49ac321ff7c85d51d4fc09b7","after":"87a273df2dfd8d3ca33a1d52b8a4d0575af0ebfcf5651ad900125934ef3bf5df"},
  "features/blog/pages/BlogArchivePage.tsx": {"before":"8e79c488b53718920e07184bb7e65d199ea4d6f2aa3421d48f9b98589bef589c","after":"a5ecfe50bcb34368d7d0477f41102cb8ea70f1a4cf879e4a9f260743a114a8f7"},
  "features/blog/pages/BlogCategoryPage.tsx": {"before":"1411abf041ec54d8e83d22510b90c923d497f46ec292434d56bdcc8b560e246d","after":"ca7090a27fb42eea89812cb4efcccb6748e5a7c841b9f0b1a0c4e33582a8fd56"},
  "features/blog/website-43/ArticleCardEngagement.tsx": {"before":"79c5f95a780a12a28094ad66c130ebd1ea9939780ace2a0a12879647804f6f82","after":"e94afc1756d1fe46d39246f66b9cd9b3b26b941d1796dae0fe03490dc6a0430f"},
  "features/blog/website-43/ArticleDetailAccess.tsx": {"before":"a25a584fede138b706ad3b61064b49da3c5ddd443529d6cf89aef015eb547dc1","after":"8da97bfc4cba49d222ff58a8026d5280d9718b85e7be589955aaf53a7978f7d9"},
  "features/blog/website-43/ArticleEngagement.tsx": {"before":"d50c6ecf34f9f682909b21158dc016abd584f48d958f750a6ad6225287152746","after":"5b1cd1352362acf4c60c84774c9c8cf9e84a754821b221244c36cb18b3e53d51"},
  "features/blog/website-43/ArticleShareActions.tsx": {"before":"79ab0fffd92dd374607777e10fa285808a445f3c4848d9471d5d9d0097f833ab","after":"9063b511fd196ba2a8481135c535a13e060593e156fb5ef4040e5e4f3408de1e"},
  "features/blog/website-43/Website43Article.tsx": {"before":"3e161d551d7a5c779753fe88193c857cd221209818471a2d1afb8c4f02c65f2c","after":"e05ccef2626731b97ecbcea6e7746167289038ec2463e12ec99968f640bda9a5"},
  "features/blog/website-43/Website43ArticleBody.tsx": {"before":"051738dd345c7fdee2d740ca2d31020ce697abc3ea22227a05f9559b885454d8","after":"36eb4256c58c6fa6ac7a2cb7ec55c8735c7726d329d6b0cb072257269301863c"},
  "features/blog/website-43/Website43ArticleOverview.tsx": {"before":"0957a8880d425c6b58e234a1991a963814d46e14a8e5a81e087e6582759de474","after":"0706a3a19ac50424a021c2c975b993c2a1ac1242ab48c982744b50a60a1b2d2d"},
  "features/blog/website-43/Website43ArticleToc.tsx": {"before":"65441545727b6c1c73080080570106cfc5d283026bb0db875fbf577cdbb66270","after":"258d8852bd1e182e58a616df977df0a02a298db2cd30de290ffcc94da35c6cab"},
  "features/blog/website-43/Website43Blog.tsx": {"before":"4fab6ca4931b548211cf63917f3ea901c9798ad44e68f51bf1acc3832fdf3bad","after":"d5a8dd29559b520887d2a2f2700bc1410a4f930a653dffb28269032538a81da3"},
  "features/blog/website-43/Website43BlogInteractive.tsx": {"before":"c603b2aba35ec8f952bd862d6757b90b9d46b33bbda075a0522e09ac13fc6ec0","after":"30b860fda3148b2f80fd7427298432d92b6772f46e590153c8d07db4f039d0f6"},
  "features/blog/website-43/blogData.ts": {"before":"76357d5d6162e65b3abf04b602fbed22df475e9590e309860322ee79d6e81dcc","after":"f87d52a1e511daa7905667547a18129e93cd83e2971f052cfc074850448f54a1"},
  "features/ci-planning/calculator/schemas.ts": {"before":"53965eb168b40043cfc007f96f7ade90344866e177bb828eb5bba6afd8b2bb46","after":"1ce62138d7c4a0a65e50ccc8bd48296db30f805289ae511210cb88445681f491"},
  "features/ci-planning/components/CILandingIntro.tsx": {"before":"634ffdf75d18bfe63a110c3d798b164fe0cbb4410dd56d8845be411e5ff52d0b","after":"571aa84c26251f12779f34df925f7e1b259878225844409bd2dfc48689b2b0b0"},
  "features/ci-planning/components/CIWizard.tsx": {"before":"6f529c5234721605ecea12651351f09129f9c79827dc6c8b8173187ca8e2b86f","after":"e417b1936cd8a725ed0c8ed7f242ef260c2cc75e1b41359472f603346f8a9567"},
  "features/ci-planning/components/ResultImageDownloadButton.tsx": {"before":"379c8a552f20b7dea695093758a3b7adb1885ac2605616fcb234070d33499dee","after":"226124b5d86abf871cc7b3859b40bb989ee18b6a12c0a7f76b78fbc1a8312c22"},
  "features/ci-planning/components/result/CIResult.tsx": {"before":"a2caa60d5139289acaf67cb05658b795ab0db05bb7adbc740447289d7169af42","after":"360a73930de75633652ddf51d199b05750ea8c2e29f6dace15091c970d485781"},
  "features/ci-planning/components/steps/ExpenseObligationsSection.tsx": {"before":"a7c2e89457fba2da585cf9972df44113597023c2ae7bb3de6c82c906639fcd6c","after":"c6a948547f6a5c831537b43a6bf3d03c791e343d9b27c598663ea5795bd84cd2"},
  "features/ci-planning/components/steps/RecoveryReserveSection.tsx": {"before":"8d13ccb26c52c52f1e3429ac181afb58e1d6922232864e5dc143a9cd6c95060b","after":"06bab1623baaec9875c2a409fd7d8a5c69f42dca03b98753d27ec8cdec18de3d"},
  "features/ci-planning/components/steps/StepExistingCI.tsx": {"before":"771331fa2749454f1494bbeb1b3be284af044b2a66ea528ff3b71f4c25e89a89","after":"bcbcd6d3015095f25850448c7f4e24255d35a8209165500fc60705a0b836ebfd"},
  "features/ci-planning/components/steps/StepExpenses.tsx": {"before":"d178d58769cbd134d8414c0625e7083547cc49cca422d7e3665020074976a1a7","after":"1f96973a0127354fd12a4df9b69de2e44884916c9e04355fe683f3c3e59454a1"},
  "features/ci-planning/page.tsx": {"before":"40a9e9759455373cc7a757bcf7e3fc5b369f702f1542d2225f33d1aec68602fb","after":"e52c9f081cbc949fc5b6f278d0a58feb9c780b6f08e927269278a56978cb7c47"},
  "features/ci-planning/result-image.ts": {"before":"477c7e2abb1f71db62b0febae624f85135a97290507d5659ffa3b198e3023889","after":"dd611b0c01b2bd8358b7df3ee9708009a65fcd4e9b2fe06ef9af3c6c7ca01845"},
  "features/financial-health-check/components/ClientFHC.tsx": {"before":"88f007c1e6c33d83bd4befdd69985363609f6c2ddb230861d548cba49c7e0fa2","after":"65873c493f37e12346019470201fe20ded0ca346b6c1cb2411b2645718260b00"},
  "features/financial-health-check/components/FHCLandingIntro.tsx": {"before":"8740261ccd02f6bff6da64a83c3ba175ddf3d30bbbc85198fb08c325b05e6b76","after":"647eea6bf3bd725939857b54454fa9e8affea3bfc4a95a19a9aa4938ca554b2c"},
  "features/financial-health-check/components/FHCLifeResultImageDownloadButton.tsx": {"before":"c49379902076c490d9c94b5200dd7bee32872a6a39837244f2a6e224bb898942","after":"aaf53c9ce01d2744fbb4645885e34f25a375409811e6233c5fded01d4bd15cb7"},
  "features/financial-health-check/components/LifeCoverageWizard.tsx": {"before":"89448a29974ef184232d2a9aa7a47e588cd7b748106a6bd496ae64f2a6f09dd5","after":"eec8919d3e3dafc49265574674fa843e443afa50429244fc6f0fa845439822d4"},
  "features/financial-health-check/page.tsx": {"before":"a0647f90fc9b937a31cf0be0121a602f3bfa498594083b3cbe18dca83ec293bd","after":"09d336add15f70b947c0c2d31f78722881b8821ce84c77724c075c5098769fd9"},
  "features/home/website-43/Website43Home.tsx": {"before":"dc2a4efb448ab859570a55a53344c9f88007f19e39a6f497d18185c0ffc9f30e","after":"057a24d478bee990a530d3e63735a82497015cfc6616b0a80810d1267206252b"},
  "features/home/website-43/Website43HomeStatic.tsx": {"before":"854a75321d4511223729efc377a581d0f3581838faf37dd12f7b532f88b612d2","after":"8a75cc042c5057a1deec4c6f4304248386884035475cb8f48bf3c06ce202f78c"},
  "features/home/website-43/homeFaqs.ts": {"before":"82bf76ab9736e28a26544b3f1544650f4467881617a0d3017065d2fc9bd56409","after":"864038283c5f981552d3df15b70344bf36d371d1ffe0995fafb1cf3386039163"},
  "features/legal/pages/CookiePolicyPage.tsx": {"before":null,"after":"d6a674d4c3abbbf3d2a45c227c721dc824459ba063919dae9c50e008a2dfdf08"},
  "features/legal/pages/PrivacyPage.tsx": {"before":null,"after":"585037f50c6bf2968acefbe023c9daa7bde0b0a5bf2f38d2da7a421a588f1c72"},
  "features/money-story/components/MoneyStoryGame.tsx": {"before":"1628800ae52abfd0c6b67a636904eb7c717d43058660700aef3bd1a68c8f468d","after":"f0c3c1ac566e46a4465d068843becdacc31d9877c22710e4dd36a0a4158f69f9"},
  "features/money-story/components/MoneyStoryScreens.tsx": {"before":"bd05ee383cf07515b97e679ee79c1de4200d5a1253796aae96399cd62d02c618","after":"217c83a2b12f8b34b793749f2fd0b1bd38a7eb793c328acf51b9c3dbd1212831"},
  "features/money-story/components/MoneyStoryStatusSidebar.tsx": {"before":"6ec4b01b4930d5b14d95073a168e2d87e982ae611edb4945d0ff8accf301ec9b","after":"7731b451eefb1e0c5fe91b3a7a0c31c38b2cc2eadc498dc1a4aea08688e3bb43"},
  "features/money-story/page.tsx": {"before":"82f5d5c4e21df8663c7881e7dc7d1793654f84ee7875654ac27f75f98d32b45b","after":"88333aaf339ceacdb87a34b099640e93b83dfe34ddd55990f84c59d1c1eb34d8"},
  "lib/admin/public-copy-preview.ts": {"before":null,"after":"4f9df5d953f0648a7186e3f8d63054b87402e581cce51c8b5a266418c4c26b39"},
  "lib/content/blog-copy-defaults.ts": {"before":null,"after":"d31a51012fb99659bf4e9678c64654b862ce3c4929e6c4744845af0c2ae80875"},
  "lib/content/legal-copy-defaults.ts": {"before":null,"after":"39ed45c336a65aec54a1dbe5b4b50bd77d774d305ec288cbb7eca0b5a5668f82"},
  "lib/content/money-story-copy-defaults.ts": {"before":null,"after":"c5129fb710e5a28a64abb07f9268c8d2931848d2901739ffd21e7ab363a89242"},
  "lib/content/page-seo-registry.ts": {"before":null,"after":"c50522cfb2d033f904106f4a574f61984dc91602b603002098d90d29b1c044e7"},
  "lib/content/public-copy-registry.ts": {"before":null,"after":"b6ffb074fcca343806f404800e251980decec3026fb13c783ff3e821137765e7"},
  "lib/content/public-copy.ts": {"before":null,"after":"fe2f34b82b8e02b87b6d71502d089951d14e8bd1789a458a4d4c0bbfa3b77d9c"},
  "lib/content/site-copy-defaults.ts": {"before":null,"after":"621622421b8fbdc8f534a01b7c2a2dfe5991a6e58c76c4cdaef32dcbad71911c"},
  "lib/content/tool-copy-defaults.ts": {"before":null,"after":"f20a2fb52b7c7b830cb5abf612f589c011d821b577452d02c72b90979ca8164e"},
  "lib/seo/page-seo.ts": {"before":null,"after":"11cffcb2b28b9481a52cc0286d551a55b35e12000cfd2df6d1f517b2309d399d"},
  "lib/shared/result-share-image.ts": {"before":"cdaf2d4d6250fba465da141b05109f1b722c5a3becc07d2499a2257fd2bd44ac","after":"3bf778cfc91e762cea07ab622725db686e6361a7a7234d454ad88bdaeb6be719"}
};
const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
export const cmsSha = value => createHash('sha256').update(value).digest('hex');

// Every historical manifest remains byte-exact; only the following explicitly
// registered prior-source chain identities can bridge its older projection to b871.
const frozenCmsProofs={
  "qa/phase1-source-ownership.json": "2a50bc9b14e0eaad932f6981010fed44fdc29b71e4778496c5073115aeb9bf89",
  "qa/phase2-css-delivery-parity.json": "aa54c12b8dcfe5f85dde50ba4d60333a66a80a398c6bad879fcf050b0eee9335",
  "qa/production-code-only-parity.json": "c177be0bcc8fba3fb8abbf2085e08ae8db31c0d52852e78ebbe464416e4fffca"
};
export const productionCmsPriorChains={
  "apps/web/app/blog/page.tsx": {"before":"29a233316183374446d117aeb0d9fc9ccba52d43055e5552e4f3f80ec550f5ce","reference":["qa/production-code-only-parity.json","protected","29a233316183374446d117aeb0d9fc9ccba52d43055e5552e4f3f80ec550f5ce"],"chain":"exact prior admitted raw source"},
  "apps/web/app/ci-planning/page.tsx": {"before":"1bcec72d36fbf2cb3239620f21399ca9192eb259043f8f175bfeaec3a4868048","reference":["qa/production-code-only-parity.json","protected","1bcec72d36fbf2cb3239620f21399ca9192eb259043f8f175bfeaec3a4868048"],"chain":"exact prior admitted raw source"},
  "apps/web/app/cookie-policy/page.tsx": {"before":"a6925d6982d0251d74542a8c4fdea408082454f243e0f83b52bcec124d767a9a","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","a6925d6982d0251d74542a8c4fdea408082454f243e0f83b52bcec124d767a9a"],"chain":"exact prior admitted raw source"},
  "apps/web/app/layout.tsx": {"before":"610af9138cc5e8af09e2b9dd00dc772ee9b8a189daf83f19b478540b000524e4","reference":["qa/phase1-source-ownership.json","compositions.candidateSha256","daa07176ae85638c47960e0561fc28da4cef4101fb12f1f73bf10eaccee4b472"],"chain":"approved critical/noncritical Kanit500 + swap font delivery"},
  "apps/web/app/not-found.tsx": {"before":"d5f055450e92852aaf5e1b5110760a273156a65ef3e274e7b028de56afc6cd57","reference":["qa/production-code-only-parity.json","protected","73fb0bf30b6e8302c1526d9f9ce979147377938026c03f4de2a60d9bb1f31fe8"],"chain":"three exact native wrapped bounded recovery-button styles"},
  "apps/web/app/page.tsx": {"before":"078e4f47f6cfdeb924604610b87ac0f8abe51bd1bc064bf33e91f8f5501dd3b7","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","078e4f47f6cfdeb924604610b87ac0f8abe51bd1bc064bf33e91f8f5501dd3b7"],"chain":"exact prior admitted raw source"},
  "apps/web/app/play/money-story/page.tsx": {"before":"82d0e4b963086b418224683ae699f51b6b1604e6969f01c297e0b8b521e1f00f","reference":["qa/production-code-only-parity.json","protected","82d0e4b963086b418224683ae699f51b6b1604e6969f01c297e0b8b521e1f00f"],"chain":"exact prior admitted raw source"},
  "apps/web/app/privacy/page.tsx": {"before":"b33b13f6e96896e52fcbf6183c9c828904f071214ef7bf00c871054553924720","reference":["qa/production-code-only-parity.json","protected","b33b13f6e96896e52fcbf6183c9c828904f071214ef7bf00c871054553924720"],"chain":"exact prior admitted raw source"},
  "apps/web/app/tools/financial-health-check/page.tsx": {"before":"3e572c982951b4ecea1e5d0786841ff28535f80cfccacb7907de290fd452e396","reference":["qa/production-code-only-parity.json","protected","3e572c982951b4ecea1e5d0786841ff28535f80cfccacb7907de290fd452e396"],"chain":"exact prior admitted raw source"},
  "components/layout/CookieSettingsButton.tsx": {"before":"3b457fc4ae228c0935b9bbe94899fab994ebec4c66f6b3925085367847433c1d","reference":["qa/production-code-only-parity.json","protected","3b457fc4ae228c0935b9bbe94899fab994ebec4c66f6b3925085367847433c1d"],"chain":"exact prior admitted raw source"},
  "components/layout/website-43/Website43Navbar.tsx": {"before":"3ec52233fa899aa0792fd7555ee7e4d822cd53d9db1367225b394628254543f3","reference":["qa/phase2-css-delivery-parity.json","reviewedUxOwners.candidateSha256","3ec52233fa899aa0792fd7555ee7e4d822cd53d9db1367225b394628254543f3"],"chain":"exact prior admitted raw source"},
  "components/layout/website-43/Website43Shared.tsx": {"before":"45433f4cf955c8705f020303cfefd51acba6fcf5e401654df8f0c1f3379ac8b6","reference":["qa/phase2-css-delivery-parity.json","reviewedUxOwners.candidateSha256","45433f4cf955c8705f020303cfefd51acba6fcf5e401654df8f0c1f3379ac8b6"],"chain":"exact prior admitted raw source"},
  "components/ui/HumanCalculatorCard.tsx": {"before":"4e8acb7c79693ab5fecb45383355324a808109a7441e55a421b3c63f8b4cf1c4","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","4e8acb7c79693ab5fecb45383355324a808109a7441e55a421b3c63f8b4cf1c4"],"chain":"exact prior admitted raw source"},
  "components/ui/MoneyComparison.tsx": {"before":"9bd1947f4b087d50c4454ad2dca27a4e8a2136a0e067f79a00c330a6f5c196a3","reference":["qa/production-code-only-parity.json","protected","9bd1947f4b087d50c4454ad2dca27a4e8a2136a0e067f79a00c330a6f5c196a3"],"chain":"exact prior admitted raw source"},
  "features/analytics/components/CookieConsent.tsx": {"before":"c33b93274de762aaf9a08536de65c6263da761513edab7d11c37f5f22632ec87","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","c33b93274de762aaf9a08536de65c6263da761513edab7d11c37f5f22632ec87"],"chain":"exact prior admitted raw source"},
  "features/analytics/components/CookieConsentPreferences.tsx": {"before":"bfa0c44d6fd9342349227b69c4a249845d48ab1c49ac321ff7c85d51d4fc09b7","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","bfa0c44d6fd9342349227b69c4a249845d48ab1c49ac321ff7c85d51d4fc09b7"],"chain":"exact prior admitted raw source"},
  "features/blog/pages/BlogArchivePage.tsx": {"before":"8e79c488b53718920e07184bb7e65d199ea4d6f2aa3421d48f9b98589bef589c","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","8e79c488b53718920e07184bb7e65d199ea4d6f2aa3421d48f9b98589bef589c"],"chain":"exact prior admitted raw source"},
  "features/blog/pages/BlogCategoryPage.tsx": {"before":"1411abf041ec54d8e83d22510b90c923d497f46ec292434d56bdcc8b560e246d","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","1411abf041ec54d8e83d22510b90c923d497f46ec292434d56bdcc8b560e246d"],"chain":"exact prior admitted raw source"},
  "features/blog/website-43/Website43Article.tsx": {"before":"3e161d551d7a5c779753fe88193c857cd221209818471a2d1afb8c4f02c65f2c","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","d6415bfcdee858ba052a3c78077f302463ef1db2ce128cb15257c74653a93bb2"],"chain":"approved author byline + Thai wrapping + published overview insertion"},
  "features/blog/website-43/Website43ArticleBody.tsx": {"before":"051738dd345c7fdee2d740ca2d31020ce697abc3ea22227a05f9559b885454d8","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","a6e73b3fe0e67d728be2e4d26083ae08be17ad4493c31431145b8d74297dba07"],"chain":"approved intro paragraph styling only"},
  "features/blog/website-43/Website43ArticleToc.tsx": {"before":"65441545727b6c1c73080080570106cfc5d283026bb0db875fbf577cdbb66270","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","9c88a2f091174b0a492d10ae2c1e63ed6bb099aa0fe2ef2bf3d1f6de15cc6f86"],"chain":"approved local Thai wrap styles only"},
  "features/blog/website-43/Website43Blog.tsx": {"before":"4fab6ca4931b548211cf63917f3ea901c9798ad44e68f51bf1acc3832fdf3bad","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","4fab6ca4931b548211cf63917f3ea901c9798ad44e68f51bf1acc3832fdf3bad"],"chain":"exact prior admitted raw source"},
  "features/blog/website-43/Website43BlogInteractive.tsx": {"before":"c603b2aba35ec8f952bd862d6757b90b9d46b33bbda075a0522e09ac13fc6ec0","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","229035fb264ee95052543622aee9211f18d4badd314af8accbba72f78b14ad80"],"chain":"approved native article engagement card + Thai wrap styles"},
  "features/blog/website-43/blogData.ts": {"before":"76357d5d6162e65b3abf04b602fbed22df475e9590e309860322ee79d6e81dcc","reference":["qa/production-code-only-parity.json","protected","638ad83c50a55ad09816327d22d63447679c417be3dd58e0680c27ef8a6fc886"],"chain":"approved stable actual Article ID in card data"},
  "features/ci-planning/calculator/schemas.ts": {"before":"53965eb168b40043cfc007f96f7ade90344866e177bb828eb5bba6afd8b2bb46","reference":["qa/production-code-only-parity.json","protected","53965eb168b40043cfc007f96f7ade90344866e177bb828eb5bba6afd8b2bb46"],"chain":"exact prior admitted raw source"},
  "features/ci-planning/components/CILandingIntro.tsx": {"before":"634ffdf75d18bfe63a110c3d798b164fe0cbb4410dd56d8845be411e5ff52d0b","reference":["qa/production-code-only-parity.json","protected","634ffdf75d18bfe63a110c3d798b164fe0cbb4410dd56d8845be411e5ff52d0b"],"chain":"exact prior admitted raw source"},
  "features/ci-planning/components/CIWizard.tsx": {"before":"6f529c5234721605ecea12651351f09129f9c79827dc6c8b8173187ca8e2b86f","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","6f529c5234721605ecea12651351f09129f9c79827dc6c8b8173187ca8e2b86f"],"chain":"exact prior admitted raw source"},
  "features/ci-planning/components/ResultImageDownloadButton.tsx": {"before":"379c8a552f20b7dea695093758a3b7adb1885ac2605616fcb234070d33499dee","reference":["qa/production-code-only-parity.json","protected","379c8a552f20b7dea695093758a3b7adb1885ac2605616fcb234070d33499dee"],"chain":"exact prior admitted raw source"},
  "features/ci-planning/components/result/CIResult.tsx": {"before":"a2caa60d5139289acaf67cb05658b795ab0db05bb7adbc740447289d7169af42","reference":["qa/production-code-only-parity.json","protected","a2caa60d5139289acaf67cb05658b795ab0db05bb7adbc740447289d7169af42"],"chain":"exact prior admitted raw source"},
  "features/ci-planning/components/steps/ExpenseObligationsSection.tsx": {"before":"a7c2e89457fba2da585cf9972df44113597023c2ae7bb3de6c82c906639fcd6c","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","a7c2e89457fba2da585cf9972df44113597023c2ae7bb3de6c82c906639fcd6c"],"chain":"exact prior admitted raw source"},
  "features/ci-planning/components/steps/RecoveryReserveSection.tsx": {"before":"8d13ccb26c52c52f1e3429ac181afb58e1d6922232864e5dc143a9cd6c95060b","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","8d13ccb26c52c52f1e3429ac181afb58e1d6922232864e5dc143a9cd6c95060b"],"chain":"exact prior admitted raw source"},
  "features/ci-planning/components/steps/StepExistingCI.tsx": {"before":"771331fa2749454f1494bbeb1b3be284af044b2a66ea528ff3b71f4c25e89a89","reference":["qa/production-code-only-parity.json","protected","771331fa2749454f1494bbeb1b3be284af044b2a66ea528ff3b71f4c25e89a89"],"chain":"exact prior admitted raw source"},
  "features/ci-planning/components/steps/StepExpenses.tsx": {"before":"d178d58769cbd134d8414c0625e7083547cc49cca422d7e3665020074976a1a7","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","d178d58769cbd134d8414c0625e7083547cc49cca422d7e3665020074976a1a7"],"chain":"exact prior admitted raw source"},
  "features/ci-planning/page.tsx": {"before":"40a9e9759455373cc7a757bcf7e3fc5b369f702f1542d2225f33d1aec68602fb","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","40a9e9759455373cc7a757bcf7e3fc5b369f702f1542d2225f33d1aec68602fb"],"chain":"exact prior admitted raw source"},
  "features/ci-planning/result-image.ts": {"before":"477c7e2abb1f71db62b0febae624f85135a97290507d5659ffa3b198e3023889","reference":["qa/production-code-only-parity.json","protected","477c7e2abb1f71db62b0febae624f85135a97290507d5659ffa3b198e3023889"],"chain":"exact prior admitted raw source"},
  "features/financial-health-check/components/ClientFHC.tsx": {"before":"88f007c1e6c33d83bd4befdd69985363609f6c2ddb230861d548cba49c7e0fa2","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","88f007c1e6c33d83bd4befdd69985363609f6c2ddb230861d548cba49c7e0fa2"],"chain":"exact prior admitted raw source"},
  "features/financial-health-check/components/FHCLandingIntro.tsx": {"before":"8740261ccd02f6bff6da64a83c3ba175ddf3d30bbbc85198fb08c325b05e6b76","reference":["qa/production-code-only-parity.json","protected","8740261ccd02f6bff6da64a83c3ba175ddf3d30bbbc85198fb08c325b05e6b76"],"chain":"exact prior admitted raw source"},
  "features/financial-health-check/components/FHCLifeResultImageDownloadButton.tsx": {"before":"c49379902076c490d9c94b5200dd7bee32872a6a39837244f2a6e224bb898942","reference":["qa/production-code-only-parity.json","protected","c49379902076c490d9c94b5200dd7bee32872a6a39837244f2a6e224bb898942"],"chain":"exact prior admitted raw source"},
  "features/financial-health-check/components/LifeCoverageWizard.tsx": {"before":"89448a29974ef184232d2a9aa7a47e588cd7b748106a6bd496ae64f2a6f09dd5","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","89448a29974ef184232d2a9aa7a47e588cd7b748106a6bd496ae64f2a6f09dd5"],"chain":"exact prior admitted raw source"},
  "features/financial-health-check/page.tsx": {"before":"a0647f90fc9b937a31cf0be0121a602f3bfa498594083b3cbe18dca83ec293bd","reference":["qa/production-code-only-parity.json","protected","a0647f90fc9b937a31cf0be0121a602f3bfa498594083b3cbe18dca83ec293bd"],"chain":"exact prior admitted raw source"},
  "features/home/website-43/Website43Home.tsx": {"before":"dc2a4efb448ab859570a55a53344c9f88007f19e39a6f497d18185c0ffc9f30e","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","dc2a4efb448ab859570a55a53344c9f88007f19e39a6f497d18185c0ffc9f30e"],"chain":"exact prior admitted raw source"},
  "features/home/website-43/Website43HomeStatic.tsx": {"before":"854a75321d4511223729efc377a581d0f3581838faf37dd12f7b532f88b612d2","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","854a75321d4511223729efc377a581d0f3581838faf37dd12f7b532f88b612d2"],"chain":"exact prior admitted raw source"},
  "features/home/website-43/homeFaqs.ts": {"before":"82bf76ab9736e28a26544b3f1544650f4467881617a0d3017065d2fc9bd56409","reference":["qa/production-code-only-parity.json","protected","82bf76ab9736e28a26544b3f1544650f4467881617a0d3017065d2fc9bd56409"],"chain":"exact prior admitted raw source"},
  "features/money-story/components/MoneyStoryGame.tsx": {"before":"1628800ae52abfd0c6b67a636904eb7c717d43058660700aef3bd1a68c8f468d","reference":["qa/phase2-css-delivery-parity.json","moneyComposition.controllerSha256","1628800ae52abfd0c6b67a636904eb7c717d43058660700aef3bd1a68c8f468d"],"chain":"exact prior admitted raw source"},
  "features/money-story/components/MoneyStoryScreens.tsx": {"before":"bd05ee383cf07515b97e679ee79c1de4200d5a1253796aae96399cd62d02c618","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","bd05ee383cf07515b97e679ee79c1de4200d5a1253796aae96399cd62d02c618"],"chain":"exact prior admitted raw source"},
  "features/money-story/components/MoneyStoryStatusSidebar.tsx": {"before":"6ec4b01b4930d5b14d95073a168e2d87e982ae611edb4945d0ff8accf301ec9b","reference":["qa/phase2-css-delivery-parity.json","moneyComposition.ownerSha256","6ec4b01b4930d5b14d95073a168e2d87e982ae611edb4945d0ff8accf301ec9b"],"chain":"exact prior admitted raw source"},
  "features/money-story/page.tsx": {"before":"82f5d5c4e21df8663c7881e7dc7d1793654f84ee7875654ac27f75f98d32b45b","reference":["qa/production-code-only-parity.json","reviewedUxOwners.candidateSha256","82f5d5c4e21df8663c7881e7dc7d1793654f84ee7875654ac27f75f98d32b45b"],"chain":"exact prior admitted raw source"}
};
export function assertProductionCmsProvenance() {
  assert.equal(cmsSha(JSON.stringify(productionCmsOwners)), '1205b8e92dafafacff0a2ff3421f3acf7ff87e4d70c65a54a4ae5540aeb269fe', 'complete exact b871 to0537 owner identity map cannot be resealed');
  for(const[file,digest]of Object.entries(frozenCmsProofs)) assert.equal(cmsSha(read(file)),digest,file+': old complete proof remains frozen');
  for(const[file,record]of Object.entries(productionCmsPriorChains)) {
    assert.equal(productionCmsOwners[file].before,record.before,file+': original b871 raw identity');
    const [proofPath,field,digest]=record.reference;const proof=JSON.parse(read(proofPath));
    const actual=field==='moneyComposition.controllerSha256'?proof.moneyComposition.controllerSha256:field==='moneyComposition.ownerSha256'?proof.moneyComposition.ownerSha256:field==='compositions.candidateSha256'?proof.compositions[file].candidateSha256:field==='reviewedUxOwners.candidateSha256'?proof.reviewedUxOwners[file].candidateSha256:proof[field][file];
    assert.equal(actual,digest,file+': original prior admission identity');
    if(record.chain==='exact prior admitted raw source') assert.equal(actual,record.before,file+': direct predecessor');
    else assert.ok(record.chain.length>20&&digest!==record.before,file+': explicit prior transform identity');
  }
  return true;
}
assertProductionCmsProvenance();
// Independently reviewed native CMS follow-up successors. These are additional
// exact source admissions; historical identity maps and output goldens stay frozen.
export const cmsNativeFollowupOwners = {
  'apps/admin/app/(control-plane)/content/website-preview/[scope]/page.tsx': { before: null, after: '077a95203d65637908cd7428bcfecdf36392c0a0f9c420c603952b27ab831b3b' },
  'lib/content/public-copy.ts': { before: '0b21f52cad4663b7376b194464be6c251a855f232774d5f7f588fefeb77d01a9', after: 'a06e7566796038415b36c95ab7ed455032b485c45a703f507c78f654c0e235b6' },
  'lib/seo/page-seo.ts': { before: '11cffcb2b28b9481a52cc0286d551a55b35e12000cfd2df6d1f517b2309d399d', after: 'afcd4d3b99592f2a71628d8931da3420f68e3d8be2800f53694f80ccf1112977' },
  'components/preview/DraftPreviewRuntime.tsx': { before: 'db35c38a0fa5d7f26b16346749a866b992a9bea86c9276191d92e08eef7eeddf', after: 'b019b273e462f1782df230d87174293c9200fe2e2fa1a37fd7c2163d684a0ec3' },
  'components/preview/LiveVisualEditing.tsx': { before: null, after: '66b19f69ff0cf7488ee0dea38e2dbf7e4b385f141fe03b391ec44981ab876320' },
  'cms/sanity/config/presentation.ts': { before: '5118bcd2307c6fefe8b40d9e37e8d298f34a05955eb2e68fcfb2b369eae3bbe0', after: '0126cf3c9839119ef6c3da5ce70b54d468a97c27fe315c01581790807f92b53a' },
  'apps/admin/app/(control-plane)/content/website-preview/page.tsx': { before: '216f98da295801c21b61d493001b274fa727ce5774b6134b808832ad69076bdd', after: '0ebaa9b82cea9fe6d71239970431a9cd460b03ebbaec300596e5317201c3f256' },
  'cms/sanity/policy/studio-policy.ts': { before: '32c6538e82089c0d4122b207695836d156b7d9676a9aacea5af9fd8112880168', after: '037cdca400a76fe7c25a433b3ff49ef113a9416fa3de25103c0b9d10ecdc9211' },
  'sanity.config.ts': { before: '471036fd50ddb149dc90cbe95eee7d2f319c1f8418255851e0a3ddd8048f5c41', after: 'ca8fa14a21e771ffe17df1f8896497a7033cd0b095af6ed4b067da2a077b617a' },
  'features/admin/components/AdminProtectedChrome.tsx': { before: 'c4d7b48c01a42177bdc7489e26efa81ff932f086de0fd6af3eb6135b6710c1e2', after: 'a6fcdc5f948e9ddea74ea09532dd932c1fd01427800d9321845d62c767331cbf' },
  'apps/web/app/not-found.tsx': { before: '3ebd09b78ab0158fa127ef72b22b913719ecce34bbb7a1cbd324406e8fa95ce2', after: 'e2ea4b1d9cd8d95c7ceaa26d700f653256640d152c2ba68831a4321872854a55' },
  'components/layout/CookieSettingsButton.tsx': { before: 'd12cf5f3e47cc86918415771d7639f267e13fb6479a96a00de51bfcdbefaee61', after: '369bf2f2f2f8a471e1d792a8ea0657b342b407f2e0c5663cbb110ff73592435f' },
  'components/layout/website-43/Website43Navbar.tsx': { before: 'bf505cd8c2c12ca026c13c3f3a425433d5a965f2610b285e393509e363de4ba9', after: 'af53f0f9e7222a694154e55bd0d6d8bd640673f738c65d98e2474fe752d7b4f5' },
  'components/layout/website-43/Website43Shared.tsx': { before: 'abbe38ed482a4a215f93a6a7e8d261a5927a392b55fbc8e4469e251b45c0c9a1', after: '590ea7d1a2d9ca2cc13f9e17cfd8eea6bb7e87e6807ad06c7c31ed09d7928afa' },
  'components/ui/HumanCalculatorCard.tsx': { before: 'd3aecec653b8e1ed2e7fa83212e0051804e93e035683b1f9dca30b00f7627720', after: '44caabc06c7d9151368f6cd84bcd1cd48201ee7e3653a54a4f769aead3ef31cc' },
  'components/ui/MoneyComparison.tsx': { before: 'c6d97332c2154379527ce1da5b62b08a43443a6f337fe40ecee61772e2a314e2', after: '3f0c3a9229483df806297d5ab0bf45d7d83d4e158f1a995475a4dabccead5368' },
  'components/ui/PublicCopyProvider.tsx': { before: '565e5900c54e34425b9b4ddf990c91c6cabd135157d021a791c2a006324b9088', after: 'a216ff1e505f16bb887e7f756c81b8689107d9c9567a0e2056fb256f2c2a334e' },
  'components/ui/health-happy/HealthHappyCountdown.tsx': { before: '83c7c34208f4f67a2b99c1c5bc7222bbd18087f95cf013209f42c8c8b0ffdee2', after: 'e332ed447c376433404b8f80958edb833671f9983083605d4433b415c32aac05' },
  'features/analytics/components/CookieConsent.tsx': { before: 'b15a71c32939a5018f5e4f9405d1e603b797a60a6e20841f5d7a3204045f8048', after: '29bf6a9af3ff34d8bf867acdef1a3718f7d9c27e514591fbcf32628e7de2f0af' },
  'features/analytics/components/CookieConsentPreferences.tsx': { before: '87a273df2dfd8d3ca33a1d52b8a4d0575af0ebfcf5651ad900125934ef3bf5df', after: 'a1da91f8c246c4a59f63b94c68206826d3b28889226beb604b92c0374c81d1dd' },
  'features/blog/website-43/ArticleCardEngagement.tsx': { before: 'e94afc1756d1fe46d39246f66b9cd9b3b26b941d1796dae0fe03490dc6a0430f', after: '24ad571cb679d0394445c33846442f0a7bb58da0ddc40d0b5f9ee70ef4139770' },
  'features/blog/website-43/ArticleDetailAccess.tsx': { before: '8da97bfc4cba49d222ff58a8026d5280d9718b85e7be589955aaf53a7978f7d9', after: '9b00002d896f86765bc9216adb1427454b2a734abb257b0505ca77d8f80976c9' },
  'features/blog/website-43/ArticleEngagement.tsx': { before: '5b1cd1352362acf4c60c84774c9c8cf9e84a754821b221244c36cb18b3e53d51', after: '941020bc1e53917b1fec02af8036ec4053b48e9cf4cc75abbcf41d477a5d3799' },
  'features/blog/website-43/ArticleShareActions.tsx': { before: '9063b511fd196ba2a8481135c535a13e060593e156fb5ef4040e5e4f3408de1e', after: '468315c7dc18c8b6030e8881bf6498fd5df2adc931dc5a0b48d9726c303135af' },
  'features/blog/website-43/Website43Article.tsx': { before: '4d8e5ba000d14284338f62655436265ac5905215599dc188b8e93d5f8c87d6c8', after: 'f83711498a004d6ba7a3b03b70bf6a8404ee740d5c411d61ce9cf327fe12d073' },
  'features/blog/website-43/Website43ArticleBody.tsx': { before: '36eb4256c58c6fa6ac7a2cb7ec55c8735c7726d329d6b0cb072257269301863c', after: 'f6b1fc1b297992a2f562e11662e03d38f6eb729c23043a016cc707adb44c32d8' },
  'features/blog/website-43/Website43ArticleOverview.tsx': { before: '0706a3a19ac50424a021c2c975b993c2a1ac1242ab48c982744b50a60a1b2d2d', after: '2a3f73e4bd3f3b2f75a2327f5d55fdbad4cab39aa3f99d8f2bc11e238669f09c' },
  'features/blog/website-43/Website43BlogInteractive.tsx': { before: '30b860fda3148b2f80fd7427298432d92b6772f46e590153c8d07db4f039d0f6', after: '86390aa571858f25c19403c5f8df5a9b9fe67317c63cd0ee022cfb9fe1e14774' },
  'features/ci-planning/components/CILandingIntro.tsx': { before: '571aa84c26251f12779f34df925f7e1b259878225844409bd2dfc48689b2b0b0', after: '60aeafd97e1f4c672bf1c684d385ae8a86e5b2fa7b66f291e4b0feab80682aa0' },
  'features/ci-planning/components/CIWizard.tsx': { before: 'e417b1936cd8a725ed0c8ed7f242ef260c2cc75e1b41359472f603346f8a9567', after: '381a97ab68a8d7bfbe82d55e6457b0f123b7c0a6de5f3e6ca3a5b3804a9cea26' },
  'features/ci-planning/components/ResultImageDownloadButton.tsx': { before: '226124b5d86abf871cc7b3859b40bb989ee18b6a12c0a7f76b78fbc1a8312c22', after: '2cae8b9c5b7a6d9bd0828781957c0011319b2fdace56bad8554863f785af5ab7' },
  'features/ci-planning/components/result/CIResult.tsx': { before: '360a73930de75633652ddf51d199b05750ea8c2e29f6dace15091c970d485781', after: 'b7c793111a1d654e89dcaf1392daf6b3b0bc53f0f310569cab465bbccdc91f85' },
  'features/ci-planning/components/steps/ExpenseObligationsSection.tsx': { before: 'c6a948547f6a5c831537b43a6bf3d03c791e343d9b27c598663ea5795bd84cd2', after: '53018c1f80d410bc3382281bd87f7c1910d29c0be56f9e4d71864b202ae89f75' },
  'features/ci-planning/components/steps/RecoveryReserveSection.tsx': { before: '06bab1623baaec9875c2a409fd7d8a5c69f42dca03b98753d27ec8cdec18de3d', after: '55fcb9ff3d909717056b1280748bb680253c4a3a7495583f2797752a4172c87a' },
  'features/ci-planning/components/steps/StepExistingCI.tsx': { before: 'bcbcd6d3015095f25850448c7f4e24255d35a8209165500fc60705a0b836ebfd', after: 'b20e79e35e4a8514a6e8d3368679f0bc4a957b01bd34d0634798b24fa2f79edf' },
  'features/ci-planning/components/steps/StepExpenses.tsx': { before: '1f96973a0127354fd12a4df9b69de2e44884916c9e04355fe683f3c3e59454a1', after: '974b450fa22ec3e1a7c08b3ab5dd32e3582510117d1f3d41a0d8792ec7d2a9e0' },
  'features/ci-planning/page.tsx': { before: 'e52c9f081cbc949fc5b6f278d0a58feb9c780b6f08e927269278a56978cb7c47', after: '980ff674a6fc1fc0908825cbcab844a09154b477755c50613934db08f9697458' },
  'features/financial-health-check/components/ClientFHC.tsx': { before: '65873c493f37e12346019470201fe20ded0ca346b6c1cb2411b2645718260b00', after: 'e8aaad6993e0228917a2d5da7e4a2e2a537ef1d2546bc4962e5cfa404b4db212' },
  'features/financial-health-check/components/FHCLandingIntro.tsx': { before: '647eea6bf3bd725939857b54454fa9e8affea3bfc4a95a19a9aa4938ca554b2c', after: '8db52b3f04aace2318c53278c223ec4a77cdf189c6796d2a420e282f7ff61298' },
  'features/financial-health-check/components/FHCLifeResultImageDownloadButton.tsx': { before: 'aaf53c9ce01d2744fbb4645885e34f25a375409811e6233c5fded01d4bd15cb7', after: 'fd827b4100f55de4653681c10b8da401e0aa3a56a30f3388b465f550e681af4e' },
  'features/financial-health-check/components/LifeCoverageWizard.tsx': { before: 'eec8919d3e3dafc49265574674fa843e443afa50429244fc6f0fa845439822d4', after: '9238203d154b3d296a78e4bfefb4f3d9bb31a491b0a05ba339d4417a7df6caa1' },
  'features/home/website-43/Website43Home.tsx': { before: '6c37917cff26a9e1006c7c5d75a901b1ae755b3b8465093d094a1dc98a92fadb', after: 'ffe20c1ff725061118eeefd5a1beccb118bc22849e6c2d23f35cd7f979580b7b' },
  'features/home/website-43/Website43HomeStatic.tsx': { before: 'c4a34c3b7eea28f9340f90284b66f417dac34ab27665a533e54d847b51ead5fc', after: '0a9b886b84ca1dba6ce9c3faf079aa22eb57beba2af1ac184fa7bf6b5c81a2e5' },
  'features/legal/pages/CookiePolicyPage.tsx': { before: 'd6a674d4c3abbbf3d2a45c227c721dc824459ba063919dae9c50e008a2dfdf08', after: '6846ce5d39782c288aa5345233b6623772b9839553668a41ec7629415460411d' },
  'features/legal/pages/PrivacyPage.tsx': { before: '585037f50c6bf2968acefbe023c9daa7bde0b0a5bf2f38d2da7a421a588f1c72', after: '4ef0f5077d3d6c6d77d3c5bdc7316c1cb7716a232bfecf0242e808973d062295' },
  'features/money-story/components/MoneyStoryGame.tsx': { before: 'f0c3c1ac566e46a4465d068843becdacc31d9877c22710e4dd36a0a4158f69f9', after: '96e97b9614a779569cd0da7aafdd839d3379e9d652858551ec29bce7306a4e4c' },
  'features/money-story/components/MoneyStoryScreens.tsx': { before: '217c83a2b12f8b34b793749f2fd0b1bd38a7eb793c328acf51b9c3dbd1212831', after: 'f5164f5715f2c33b921a53304b4e6116a1273b7cb2064d709bdc071f5873cc17' },
  'features/money-story/components/MoneyStoryStatusSidebar.tsx': { before: '7731b451eefb1e0c5fe91b3a7a0c31c38b2cc2eadc498dc1a4aea08688e3bb43', after: 'cc3c449593e971072d55dbbcc47771a37bf8f61c7c745f3a6e6859c525b8e5ff' },
  'features/money-story/page.tsx': { before: '88333aaf339ceacdb87a34b099640e93b83dfe34ddd55990f84c59d1c1eb34d8', after: '83f1719473106c1f47b1022e9f7bd642c4e3fc87f7b546a869e70b9108f4296d' },
  'lib/admin/public-copy-preview.ts': { before: '4f9df5d953f0648a7186e3f8d63054b87402e581cce51c8b5a266418c4c26b39', after: '9538b4faab828cf6919a573a0ae8a321a1c2ff43514117ee41ed9b465addc3f2' },
  'lib/content/public-copy-registry.ts': { before: 'b6ffb074fcca343806f404800e251980decec3026fb13c783ff3e821137765e7', after: '9712dcf42084d5097624e84ce5ef3cb2bae936f61fc472c4d57bc3390a021a29' },
};
// Exact canonical navigation transition; every original owner digest stays frozen.
// Counts are per owned source, so missing/duplicate links and unrelated edits fail.
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
export function assertProductionCmsOwner(file, source = read(file)) {
  assert.equal(cmsSha(JSON.stringify(productionCmsOwners)), '1205b8e92dafafacff0a2ff3421f3acf7ff87e4d70c65a54a4ae5540aeb269fe', 'frozen CMS identities');
  assert.ok(hasProductionCmsOwner(file), 'Unknown CMS source owner: '+file);
  source = websiteV5InvestmentCopyPredecessor(file, source);
  // Website v5 Phase A (UAT prototype): an exact reviewed v5 route successor, or the
  // exact additive v5 copy keys removed to reconstruct the frozen registry source.
  source = cookieBannerTimingPredecessor(file, moneyStoryDockPredecessor(file, eyebrowPredecessor(file, source)));
  if (isWebsiteV5ReviewedSuccessor(file, source)) return true;
  source = websiteV5CopyPredecessor(file, source);
  if (file === 'lib/content/sanity.ts') {
    // Owner-approved article-body font-size marks (2026-10-24): only these exact
    // converter additions may be removed to reconstruct the frozen reader.
    for (const [current, old] of [
      ['import { articleFontSizeFromMarks, type ArticleFontSize } from "./article-font-size";\n', ''],
      ['emphasis?: boolean; size?: ArticleFontSize }> }> = [];', 'emphasis?: boolean }> }> = [];'],
      ['      const size = articleFontSizeFromMarks(marks);\n', ''],
      ['        ...(size ? { size } : {}),\n', ''],
      ['segment.href || segment.strong || segment.emphasis || segment.size)', 'segment.href || segment.strong || segment.emphasis)'],
    ]) {
      assert.equal(source.split(current).length, 2, 'one exact article font-size mark transition');
      source = source.replace(current, old);
    }
    for (const [current, old] of [
      ['import { cache } from "react";\n', ''],
      ['export const getPrimaryAuthorProfile = cache(unstable_cache(\n  () => readPrimaryAuthorProfile(),', 'export const getPrimaryAuthorProfile = unstable_cache(\n  readPrimaryAuthorProfile,'],
      ['{ revalidate: 300, tags: ["ccpun-primary-author"] },\n));', '{ revalidate: 300, tags: ["ccpun-primary-author"] },\n);'],
      ['async function readPrimaryAuthorProfile(perspective: "published" | "drafts" = "published")', 'async function readPrimaryAuthorProfile()'],
      ['sanityFetch({ query: primaryAuthorQuery, perspective, stega: false })', 'sanityFetch({ query: primaryAuthorQuery, perspective: "published", stega: false })'],
      ['\nexport async function getPrimaryAuthorPreviewProfile() {\n  getSanityPreviewClient();\n  return readPrimaryAuthorProfile("drafts");\n}\n', ''],
    ]) {
      assert.equal(source.split(current).length, 2, 'one exact native request-cache wrapper');
      source = source.replace(current, old);
    }
    const frozen = JSON.parse(read('qa/production-code-only-parity.json')).reviewedUxOwners[file].candidateSha256;
    assert.equal(frozen, '2b670ca67fd7d4124b58b72339fd484639f9a5ba7e1053010b56725ab065646b', 'original reviewed author reader remains frozen');
    assert.equal(cmsSha(source), '036885be4019b588fa26d7bb6e4d8bd2cb23aa33e6fd6963951af51e0c862117', 'exact deployed author reader before request memoization');
    for (const addition of ['    optimizedAt: raw.contentOptimizedAt,\n', '  contentOptimizedAt,\n']) {
      assert.equal(source.split(addition).length, 2, 'original optimization-date admission is unchanged');
      source = source.replace(addition, '');
    }
    assert.equal(cmsSha(source), frozen, 'only native request memoization may wrap the unchanged author reader');
    return true;
  }
  if (Object.hasOwn(cmsNativeFollowupOwners, file)) {
    assert.equal(adminPhase1PredecessorDigest(file, source), cmsNativeFollowupOwners[file].after, file + ': exact independently reviewed native CMS successor');
    return true;
  }
  source = canonicalNavigationPredecessor(file, source);
  if (file === 'components/ui/health-happy/HealthHappyCountdown.tsx') {
    // Only the exact Blog artwork hint may reconstruct the frozen same-word source.
    const blogPreloadAdditions = [
      "import { preload } from 'react-dom';\n",
      "import countdownArtwork from '@/public/assets/blog-migration/aia-health-happy-describe/featured-01-AIA-Health-Happy-article.lossless.webp';\n",
      "  if (placement === 'blog') {\n    preload(countdownArtwork.src, { as: 'image', fetchPriority: 'high' });\n  }\n",
    ];
    for (const addition of blogPreloadAdditions) {
      assert.equal(source.split(addition).length, 2, 'exact Blog-only countdown preload transition');
      source = source.replace(addition, '');
    }
  }
  // Preserve the original 74-owner proof. Only this exact published-only
  // hardening may reconstruct its reviewed predecessor; the predecessor itself
  // and every unrelated source change remain denied as current runtime source.
  if (file === 'lib/content/public-copy.ts') {
    const publishedOnlyInverse = [
      [
            "import { sanityFetch } from \"./sanity-fetch\";",
            "import { draftMode } from \"next/headers\";\nimport { sanityFetch } from \"./sanity-fetch\";\nimport { IS_DRAFT_PREVIEW_ALLOWED } from \"../deployment-environment\";"
      ],
      [
            "export const getPublicCopy = cache(async (scope: PublicCopyScope) => {\n  try {",
            "export const getPublicCopy = cache(async (scope: PublicCopyScope) => {\n  const preview = IS_DRAFT_PREVIEW_ALLOWED && (await draftMode()).isEnabled;\n  try {"
      ],
      [
            "perspective: \"published\",",
            "perspective: preview ? \"drafts\" : \"published\","
      ]
];
    for (const [current, predecessor] of publishedOnlyInverse) {
      assert.equal(source.split(current).length, 2, 'exact published-only copy reader transition');
      source = source.replace(current, predecessor);
    }
  }
  assert.equal(cmsSha(source), productionCmsOwners[file].after, file+': exact reviewed same-word CMS source');
  return true;
}
export function hasProductionCmsOwner(file) { return file === 'lib/content/sanity.ts' || Object.hasOwn(productionCmsOwners,file) || Object.hasOwn(cmsNativeFollowupOwners,file); }

let defaults;
function allDefaults() {
  if (!defaults) {
    const registry = loadFixtureModule('lib/content/public-copy-registry.ts');
    defaults = Object.assign({},...Object.values(registry.PUBLIC_COPY_SCOPES).map(scope=>scope.defaults));
  }
  // Changes to extracted defaults must never hide behind a source-only assertion.
  for(const file of Object.keys(productionCmsOwners).filter(file=>file.startsWith('lib/content/'))) assertProductionCmsOwner(file);
  return defaults;
}
// Supplementary literal-source assertions follow the actual CMS lookup, replacing
// only a constant registered default. Expressions, order, routes, aria and math
// remain in the inspected candidate source. No baseline source is substituted.
export function productionCmsDisplaySource(file, source = read(file)) {
  // Website v5 Phase B: an exact retained 4.3 presentation reads like its original owner.
  const retained = isWebsiteV5RetainedSource(file, source) || websiteV5RendererSources.includes(file);
  if (!hasProductionCmsOwner(file) && !retained) return source;
  if (!retained) assertProductionCmsOwner(file,source);
  const legalOwners = {"apps/web/app/privacy/page.tsx":"features/legal/pages/PrivacyPage.tsx","apps/web/app/cookie-policy/page.tsx":"features/legal/pages/CookiePolicyPage.tsx"};
  if(Object.hasOwn(legalOwners,file)) return source+"\n"+productionCmsDisplaySource(legalOwners[file]);
  const values = allDefaults();
  const tree = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const replacements=[];
  function visit(node) {
    let key;
    // `text.node("key")` is the same CMS lookup rendered as a sized visible child.
    const lookup = ts.isCallExpression(node) && (ts.isIdentifier(node.expression) ? node.expression : ts.isPropertyAccessExpression(node.expression) && node.expression.name.text==='node' && ts.isIdentifier(node.expression.expression) ? node.expression.expression : null);
    if(lookup && ['t','text','copyText'].includes(lookup.text) && node.arguments.length===1 && ts.isStringLiteral(node.arguments[0])) key=node.arguments[0].text;
    if(ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text.endsWith('_COPY_DEFAULTS') && ts.isStringLiteral(node.argumentExpression)) key=node.argumentExpression.text;
    if(key!==undefined) {
      assert.ok(Object.hasOwn(values,key),'Unknown public default key: '+key);
      const parent=node.parent;
      const child=ts.isJsxExpression(parent) && ts.isJsxElement(parent.parent);
      if(child) replacements.push([parent.getStart(tree),parent.end,values[key]]);
      else if(ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) replacements.push([parent.getStart(tree),parent.end,JSON.stringify(values[key])]);
      else replacements.push([node.getStart(tree),node.end,"'"+values[key].replaceAll('\\','\\\\').replaceAll("'","\\'").replaceAll('\r','\\r').replaceAll('\n','\\n')+"'"]);
      return;
    }
    ts.forEachChild(node,visit);
  }
  visit(tree);
  for(const[start,end,value]of replacements.sort((a,b)=>b[0]-a[0])) source=source.slice(0,start)+value+source.slice(end);
  return source;
}
