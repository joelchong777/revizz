# Revizz Codebase Atlas & Line Coordinates

> **Automated Symbol Atlas**: Indexing 163 files, 89,775 lines, and 804 symbols across core modules. Generated in 227ms.

Use `npx tsx scripts/codebase-map.ts query <term>` to search symbols with exact `[L<start>-L<end>]` coordinates.

## 1. App Router Pages & API Endpoints (app/)

- **`app/admin/page.tsx`** (523 lines): `AdminPage [L503-L522]`
- **`app/admin/papers/page.tsx`** (42 lines): `AdminPapersPage [L26-L41]`
- **`app/api/admin/users/route.ts`** (443 lines): `ManagedUser [L13-L25]`, `GET [L52-L153]`, `POST [L159-L278]`, `PATCH [L285-L363]`, `DELETE [L369-L442]`
- **`app/api/ads/config/route.ts`** (129 lines): `GET [L59-L69]`, `POST [L71-L115]`, `DELETE [L117-L128]`
- **`app/api/ingest/crop/route.ts`** (146 lines): `POST [L50-L145]`
- **`app/api/ingest/extract/route.ts`** (347 lines): `POST [L45-L346]`
- **`app/api/ingest/publish/route.ts`** (484 lines): `PublishReceipt [L45-L53]`, `POST [L74-L483]`
- **`app/api/ingest/staged-paper/route.ts`** (1154 lines): `GET [L167-L730]`, `POST [L742-L1058]`, `DELETE [L1064-L1153]`
- **`app/api/ingest/verify-ms/route.ts`** (210 lines): `POST [L42-L209]`
- **`app/api/questions/delete/route.ts`** (115 lines): `POST [L23-L114]`
- **`app/api/questions/update/route.ts`** (171 lines): `POST [L23-L170]`
- **`app/layout.tsx`** (95 lines): `metadata [L35-L38]`, `viewport [L40-L46]`, `RootLayout [L48-L94]`
- **`app/not-found.tsx`** (22 lines): `NotFound [L3-L21]`
- **`app/page.tsx`** (409 lines): `HomePage [L24-L408]`
- **`app/portal/compiler/print/page.tsx`** (224 lines): `PrintPage [L208-L223]`
- **`app/portal/page.tsx`** (977 lines): `PortalPage [L959-L976]`
- **`app/profile/page.tsx`** (34 lines): `metadata [L5-L9]`, `ProfilePage [L27-L33]`
- **`app/profile/review/page.tsx`** (34 lines): `metadata [L5-L9]`, `ProfileReviewPage [L27-L33]`
- **`app/profile/settings/page.tsx`** (34 lines): `metadata [L5-L9]`, `ProfileSettingsPage [L27-L33]`
- **`app/profile/stats/page.tsx`** (34 lines): `metadata [L5-L9]`, `ProfileStatsPage [L27-L33]`

## 2. UI & Portal Components (components/)

- **`components/AppShell.tsx`** (33 lines): `AppShell [L11-L30]`
- **`components/AuthModal.tsx`** (394 lines): `AuthModalProps [L15-L20]`, `AuthModal [L22-L391]`
- **`components/Header.tsx`** (312 lines): `Header [L19-L309]`
- **`components/LeaderboardModal.tsx`** (354 lines): `LeaderboardModal [L20-L353]`
- **`components/QuestionCard.tsx`** (907 lines): `QuestionCard [L36-L904]`
- **`components/RoundSummary.tsx`** (388 lines): `RoundSummary [L31-L385]`
- **`components/SoundToggle.tsx`** (64 lines): `SoundToggle [L12-L61]`
- **`components/StartFlow.tsx`** (990 lines): `StartFlow [L23-L987]`
- **`components/StudentAuthGate.tsx`** (176 lines): `StudentAuthGate [L11-L173]`
- **`components/TopicMasteryList.tsx`** (305 lines): `TopicMasteryList [L33-L302]`
- **`components/admin/AdminSettingsHub.tsx`** (1553 lines): `AdminSettingsHubProps [L36-L40]`, `AdminSettingsHub [L70-L1552]`
- **`components/admin/AdsManagerHub.tsx`** (2298 lines): `AdsManagerHub [L115-L2297]`
- **`components/admin/AppAdminHub.tsx`** (922 lines): `AppAdminHubProps [L31-L37]`, `AppAdminHub [L39-L387]`, `EducatorSeat [L389-L396]`, `InstitutionalCohort [L398-L404]`, `SchoolLicenceManager [L406-L921]`
- **`components/admin/AppAdminNav.tsx`** (388 lines): `AppAdminNavProps [L22-L32]`, `AppAdminNav [L34-L387]`
- **`components/admin/IngestionHistoryHub.tsx`** (1307 lines): `IngestionHistoryItem [L42-L53]`, `IngestionHistoryHubProps [L55-L58]`, `IngestionHistoryHub [L113-L1306]`
- **`components/admin/PortalMenuManager.tsx`** (529 lines): `PortalMenuManager [L69-L528]`
- **`components/admin/UserManagementHub.tsx`** (1784 lines): `ManagedUser [L49-L61]`, `UserManagementHub [L167-L1783]`
- **`components/admin/WholePaperViewer.tsx`** (1112 lines): `WholePaperViewer [L42-L1111]`
- **`components/ads/AdSlotBanner.tsx`** (769 lines): `AdSlotBannerProps [L23-L38]`, `AdSlotBanner [L74-L766]`
- **`components/portal/AdminCMS.tsx`** (1154 lines): `AdminCMSProps [L40-L43]`, `AdminCMS [L45-L1153]`
- **`components/portal/AdminNav.tsx`** (437 lines): `AdminNavProps [L26-L39]`, `AdminNav [L41-L436]`
- **`components/portal/AdminTools.tsx`** (2818 lines): `QuestionBankItem [L81-L107]`, `getStatusBadgeClass [L109-L122]`, `createInitialBankItems [L124-L214]`, `BankFilterDropdown [L248-L398]`, `AdminTools [L400-L2817]`
- **`components/portal/AssignedHomeworkHub.tsx`** (636 lines): `AssignedHomeworkHubProps [L40-L44]`, `AssignedHomeworkHub [L46-L635]`
- **`components/portal/AssignedHomeworkModal.tsx`** (864 lines): `NewHomeworkModal [L77-L611]`, `SubmissionsDetailModal [L623-L863]`
- **`components/portal/IngestionAuditDrawer.tsx`** (1323 lines): `IngestionAuditDrawerProps [L28-L34]`, `AuditIssue [L38-L43]`, `QuestionAuditResult [L45-L54]`, `QualityGateCheckItem [L56-L64]`, `IngestionAuditDrawer [L1322-L1322]`
- **`components/portal/IngestionDiagnostics.tsx`** (1001 lines): `DiagnosticCheckItem [L33-L42]`, `KaTeXIssue [L44-L51]`, `IngestionDiagnosticsProps [L53-L58]`, `lintKaTeXContent [L68-L220]`, `IngestionDiagnostics [L222-L998]`
- **`components/portal/IngestionHeader.tsx`** (820 lines): `IngestionHeaderProps [L31-L70]`, `IngestionHeader [L117-L819]`
- **`components/portal/IngestionHub.tsx`** (650 lines): `IngestionHub [L25-L649]`
- **`components/portal/IngestionLivePreview.tsx`** (688 lines): `IngestionLivePreviewProps [L32-L38]`, `IngestionLivePreview [L40-L685]`
- **`components/portal/IngestionMarkSchemeModal.tsx`** (605 lines): `IngestionMarkSchemeModalProps [L24-L30]`, `IngestionMarkSchemeModal [L34-L604]`
- **`components/portal/IngestionMediaPanel.tsx`** (892 lines): `IngestionMediaPanelProps [L34-L68]`, `IngestionMediaPanel [L70-L889]`
- **`components/portal/IngestionModals.tsx`** (1082 lines): `IngestionModalsProps [L28-L37]`, `IngestionSettingsModalProps [L39-L44]`, `IngestionPayloadModalProps [L46-L52]`, `generatePostgresUpsertSql [L62-L1081]`
- **`components/portal/IngestionOptionsEditor.tsx`** (448 lines): `IngestionOptionsEditorProps [L24-L34]`, `IngestionOptionsEditor [L66-L445]`
- **`components/portal/IngestionPdfViewer.tsx`** (851 lines): `IngestionPdfViewerProps [L27-L54]`, `IngestionPdfViewer [L73-L848]`
- **`components/portal/IngestionPipelineModal.tsx`** (661 lines): `IngestionPipelineModalProps [L18-L24]`, `IngestionPipelineModal [L65-L660]`
- **`components/portal/IngestionPreviewModal.tsx`** (425 lines): `IngestionPreviewModalProps [L28-L35]`, `IngestionPreviewModal [L37-L424]`
- **`components/portal/IngestionQuestionEditor.tsx`** (313 lines): `IngestionQuestionEditorProps [L14-L23]`, `IngestionQuestionEditor [L25-L310]`
- **`components/portal/IngestionQuestionNav.tsx`** (789 lines): `IngestionQuestionNavProps [L21-L34]`, `QuestionStatusItem [L38-L47]`, `hasKaTeXSyntaxError [L52-L75]`, `evaluateQuestionStatus [L146-L197]`, `IngestionQuestionNav [L199-L786]`
- **`components/portal/IngestionSetupWizard.tsx`** (1642 lines): `SubjectPreset [L31-L35]`, `StagedPaperSummary [L37-L47]`, `CAMBRIDGE_SUBJECT_PRESETS [L49-L59]`, `IngestionSetupWizardProps [L61-L95]`, `IngestionSetupWizard [L102-L1641]`
- **`components/portal/IngestionStemEditor.tsx`** (899 lines): `IngestionStemEditorProps [L35-L49]`, `KatexSyntaxIssue [L51-L55]`, `detectKatexErrors [L60-L67]`, `IngestionStemEditor [L199-L896]`
- **`components/portal/IngestionStudioFrame.tsx`** (56 lines): `IngestionStudioFrameProps [L5-L12]`, `IngestionStudioFrame [L20-L53]`
- **`components/portal/IngestionWorkspace.tsx`** (345 lines): `IngestionWorkspaceProps [L17-L41]`, `IngestionWorkspace [L53-L342]`
- **`components/portal/StagingReview.tsx`** (12 lines): `StagingReviewProps [L3-L7]`, `StagingReview [L9-L11]`
- **`components/portal/TeacherAnalytics.tsx`** (1085 lines): `TeacherAnalyticsProps [L27-L30]`, `RosterStudent [L32-L45]`, `HeatRow [L47-L50]`, `TeacherAnalytics [L52-L1084]`
- **`components/portal/compiler/CompilerDiagramPreview.tsx`** (272 lines): `CompilerDiagramPreviewProps [L19-L25]`, `CompilerDiagramPreview [L34-L271]`
- **`components/portal/compiler/PrintableExamLayout.tsx`** (337 lines): `PrintableExamLayout [L19-L336]`
- **`components/portal/compiler/TestCompilerHub.tsx`** (3226 lines): `TestCompilerHub [L87-L3225]`
- **`components/portal/staged/StagedPaperAuditor.tsx`** (663 lines): `StagedPaperAuditorProps [L30-L34]`, `StagedPaperAuditor [L42-L660]`
- **`components/portal/staged/StagedPapersQueue.tsx`** (733 lines): `StagedPaperItem [L29-L46]`, `StagedPapersQueueProps [L48-L51]`, `StagedPapersQueue [L87-L732]`
- **`components/profile/StudentAchievementsActivityPanel.tsx`** (584 lines): `StudentAchievementsActivityPanelProps [L14-L20]`, `StudentAchievementsActivityPanel [L22-L583]`
- **`components/profile/StudentProfileHub.tsx`** (874 lines): `StudentProfileHub [L75-L873]`
- **`components/profile/StudentReviewPanel.tsx`** (784 lines): `StudentReviewPanelProps [L23-L29]`, `StudentReviewPanel [L31-L783]`
- **`components/profile/StudentSettingsPanel.tsx`** (717 lines): `StudentSettingsPanelProps [L31-L39]`, `StudentSettingsPanel [L59-L716]`
- **`components/profile/StudentStatsPanel.tsx`** (569 lines): `StudentStatsPanelProps [L7-L13]`, `StudentStatsPanel [L15-L568]`
- **`components/ui/MarkdownErrorBoundary.tsx`** (59 lines): `MarkdownErrorBoundary [L22-L56]`
- **`components/ui/badge.tsx`** (47 lines): `Badge [L40-L44]`
- **`components/ui/dialog.tsx`** (131 lines): `DialogFooter [L81-L92]`, `Dialog [L119-L130]`, `DialogPortal [L119-L130]`, `DialogOverlay [L119-L130]`, `DialogClose [L119-L130]`
- **`components/ui/select.tsx`** (236 lines): `SelectOption [L5-L9]`, `SelectProps [L11-L28]`, `Select [L30-L232]`, `NeobrutalistDropdown [L234-L234]`
- **`components/ui/tabs.tsx`** (57 lines): `Tabs [L56-L56]`, `TabsList [L56-L56]`, `TabsTrigger [L56-L56]`, `TabsContent [L56-L56]`

## 3. Core Libraries, State, Hooks & Ingestion Engine (lib/, hooks/)

- **`hooks/useQuizGame.ts`** (462 lines): `Question [L14-L40]`, `QuizRoundConfig [L44-L51]`, `MissedQuestionItem [L57-L61]`, `useQuizGame [L63-L460]`
- **`lib/ads.ts`** (863 lines): `getDefaultAdsConfig [L118-L265]`, `getSuggestedPlacements [L271-L355]`, `loadAdsConfig [L360-L440]`, `applyPlacementPreset [L609-L674]`, `shouldRenderAdSlot [L679-L743]`
- **`lib/agentBlackboard.ts`** (349 lines): `getBlackboardFilePath [L33-L54]`, `getBlackboard [L153-L182]`, `updateBlackboard [L187-L224]`, `updateWorkerStatus [L245-L271]`, `removeWorktree [L304-L318]`
- **`lib/audio.ts`** (246 lines): `setSoundEnabled [L51-L65]`, `playPop [L99-L126]`, `playChime [L131-L166]`, `playBuzzer [L171-L203]`, `playFanfare [L208-L245]`
- **`lib/auth.ts`** (580 lines): `isProviderNotEnabledError [L25-L55]`, `normalizeAuthError [L60-L118]`, `signInWithGoogle [L124-L160]`, `signUpWithEmail [L165-L183]`, `useAuth [L413-L579]`
- **`lib/barcode.tsx`** (118 lines): `encodeCode128B [L20-L38]`, `generateCode128Bars [L40-L40]`, `Code128Barcode [L63-L117]`
- **`lib/compilerFilters.ts`** (408 lines): `extractSeriesOrYear [L32-L84]`, `parseCitationTagPills [L112-L192]`, `hasDataTable [L203-L255]`, `isMathOrCalculation [L260-L283]`, `filterAndSortQuestions [L302-L386]`
- **`lib/email.ts`** (313 lines): `SendInviteEmailParams [L8-L14]`, `EmailDeliveryResult [L16-L21]`
- **`lib/ingestion/diagramCropper.ts`** (561 lines): `isDiagramBBoxValid [L30-L75]`, `normalizeBBox [L86-L135]`, `denormalizeBBox [L144-L173]`, `sanitizeDiagramFilename [L201-L211]`, `cropAndUploadImage [L326-L342]`
- **`lib/ingestion/geminiExtractor.ts`** (537 lines): `ExtractionProgress [L10-L17]`, `ExtractionOptions [L19-L26]`, `normalizeGeminiModel [L34-L49]`, `toBase64 [L51-L75]`, `extractQuestionsChunked [L124-L239]`
- **`lib/ingestion/katexSanitizer.ts`** (687 lines): `normalizeMathDelimiters [L125-L151]`, `escapeCurrencyDollars [L162-L246]`, `normalizeFractions [L268-L686]`, `normalizeGreekSymbols [L345-L408]`, `normalizeUnits [L421-L445]`
- **`lib/ingestion/markSchemeChecker.ts`** (268 lines): `MismatchType [L6-L13]`, `QuestionMismatch [L15-L27]`, `MarkSchemeVerificationReport [L31-L43]`, `checkQuestionAgainstMarkScheme [L48-L51]`, `verifyPaperAgainstMarkScheme [L187-L261]`
- **`lib/ingestion/markSchemeParser.ts`** (285 lines): `ParseMarkSchemeResult [L9-L15]`, `parseMarkSchemePdf [L23-L87]`, `parseMarkSchemeText [L96-L145]`, `findMarkSchemePdf [L157-L245]`
- **`lib/ingestion/markSchemeRemediator.ts`** (219 lines): `RemediationChange [L5-L10]`, `RemediationResult [L12-L17]`, `remediatePaperWithMarkScheme [L26-L136]`
- **`lib/ingestion/stagedPaperStorage.ts`** (503 lines): `fetchPersistentPaperStates [L31-L66]`, `savePersistentPaperStates [L68-L102]`, `getStagingLocations [L110-L144]`, `getFallbackStagingPaper [L146-L225]`, `fetchLiveSupabasePapers [L255-L357]`
- **`lib/ingestion/useIngestionStore.ts`** (1770 lines): `PublishReceipt [L17-L27]`, `IngestionState [L46-L86]`, `IngestionActions [L88-L157]`, `inferPaperMetadata [L239-L283]`, `normalizeStagingPayload [L294-L512]`
- **`lib/leaderboard.ts`** (46 lines): `LeaderboardEntry [L4-L11]`, `fetchWeeklyLeaderboard [L13-L32]`, `toggleLeaderboardOptIn [L34-L45]`
- **`lib/mastery.ts`** (251 lines): `getMasteryBadge [L46-L85]`, `getReviewPile [L117-L130]`, `addToReviewPile [L150-L164]`, `getFirstTryCorrectIds [L200-L213]`, `subscribeMasteryChanges [L237-L250]`
- **`lib/portal/assignedHomework.ts`** (768 lines): `AssignedHomeworkRound [L16-L41]`, `computeHomeworkMetrics [L73-L106]`, `saveAssignedHomework [L174-L212]`, `recordStudentSubmission [L234-L259]`, `seedInitialHomeworkIfEmpty [L275-L767]`
- **`lib/portal/bankFilters.ts`** (1087 lines): `parseCambridgePaperMetadata [L186-L300]`, `enrichBankQuestion [L461-L527]`, `filterBankQuestions [L539-L650]`, `computeBankFacetCounts [L669-L829]`, `parseBankFiltersFromQuery [L1025-L1086]`
- **`lib/portal/massActions.ts`** (386 lines): `BaseQuestionBankItem [L8-L18]`, `toggleSelectQuestion [L47-L58]`, `toggleSelectPage [L65-L80]`, `calculateClampedPage [L170-L183]`, `openMassActionModal [L305-L320]`
- **`lib/portal/menuConfig.ts`** (275 lines): `DEFAULT_PORTAL_NAV_ITEMS [L26-L107]`, `getPortalNavItems [L135-L154]`, `togglePortalMenuItem [L181-L192]`, `addPortalMenuItem [L214-L237]`, `removePortalMenuItem [L243-L258]`
- **`lib/portal/questionMetadata.ts`** (206 lines): `CambridgeQuestionMeta [L1-L17]`, `SUGGESTED_TAGS [L19-L28]`, `SUBJECT_OPTIONS [L42-L47]`, `formatCambridgeCitation [L58-L71]`, `parseCambridgeQuestionMetadata [L73-L205]`
- **`lib/questions.ts`** (1060 lines): `CAMBRIDGE_QUESTIONS [L47-L478]`, `mapDbQuestionToQuestion [L795-L843]`, `fetchQuestionsFromDb [L849-L930]`, `useQuestions [L978-L1011]`, `useTopics [L1024-L1057]`
- **`lib/resolveDiagramUrl.ts`** (32 lines): `resolveDiagramUrl [L6-L31]`
- **`lib/roster.ts`** (273 lines): `RosterInvite [L3-L12]`, `addRosterInvite [L53-L133]`, `getRosterInvites [L140-L182]`, `deleteRosterInvite [L188-L202]`, `checkAndClaimInvite [L208-L272]`
- **`lib/scoring.ts`** (98 lines): `AttemptOutcome [L19-L24]`, `ScoreCalculation [L26-L31]`, `getStreakMultiplier [L39-L43]`, `calculateAttemptScore [L48-L97]`
- **`lib/studentProfile.ts`** (911 lines): `getStudentPreferences [L100-L163]`, `recordCompletedRound [L415-L466]`, `getDailyGoalProgress [L486-L543]`, `evaluateStudentAchievements [L622-L726]`, `computeStudentStatsSummary [L762-L910]`
- **`lib/subjects.ts`** (58 lines): `DbSubject [L3-L8]`, `getSubjectEmoji [L12-L34]`, `fetchSubjectsFromDb [L36-L57]`
- **`lib/supabaseClient.ts`** (13 lines): `supabase [L11-L11]`
- **`lib/sync.ts`** (94 lines): `syncGuestDataToUser [L4-L93]`
- **`lib/testCompiler.ts`** (644 lines): `resolveCurrentAccountScope [L67-L116]`, `saveTestDraft [L136-L188]`, `loadTestDraft [L221-L286]`, `importTestDraftJson [L400-L468]`, `buildCompiledQuestions [L470-L509]`
- **`lib/utils.ts`** (7 lines): `cn [L4-L6]`

## 4. Automation & Verification CLI Scripts (scripts/)

- **`scripts/agent-memory.ts`** (1179 lines): `RuleItem [L24-L35]`, `ReflectionEntry [L37-L49]`, `MemoryStats [L64-L72]`, `DEFAULT_MEMORY_PATH [L78-L86]`, `c [L96-L114]`
- **`scripts/blackboard.ts`** (211 lines): `printHelp [L17-L52]`, `parseJsonOrString [L54-L60]`, `main [L62-L208]`
- **`scripts/codebase-map.ts`** (1227 lines): `SymbolKind [L23-L36]`, `SymbolInfo [L38-L45]`, `CodebaseIndex [L57-L68]`, `discoverFiles [L187-L216]`, `extractPurpose [L222-L1226]`
- **`scripts/ingest-paper.ts`** (669 lines): `CliOptions [L69-L84]`, `parseCliArgs [L86-L137]`, `InferredMetadata [L155-L164]`, `inferCambridgeMetadata [L170-L214]`, `upsertStagingPaperToSupabase [L224-L233]`
- **`scripts/verify-revizz.ts`** (4120 lines): `test [L167-L179]`, `testAsync [L181-L193]`, `assert [L195-L199]`
- **`scripts/verify-ui.ts`** (593 lines): `recordAssertion [L46-L62]`, `parseCliArgs [L71-L110]`, `resolveChromeExecutable [L113-L141]`
- **`scripts/wt.ts`** (1557 lines): `commandRelease [L607-L750]`, `commandClean [L755-L875]`, `commandServe [L925-L1074]`, `commandShip [L1117-L1359]`, `main [L1446-L1548]`

## 5. Database & Supabase Migrations (supabase/)

- **`supabase/migrations/20261016_question_bank_filter_columns.sql`** (19 lines): `idx_questions_subject_id [L11-L11]`, `idx_questions_topic_id [L12-L12]`, `idx_questions_active [L13-L13]`
