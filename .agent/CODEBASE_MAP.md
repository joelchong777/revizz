# Revizz Codebase Atlas & Line Coordinates

> **Automated Symbol Atlas**: Indexing 170 files, 96,152 lines, and 851 symbols across core modules. Generated in 470ms.

Use `npx tsx scripts/codebase-map.ts query <term>` to search symbols with exact `[L<start>-L<end>]` coordinates.

## 1. App Router Pages & API Endpoints (app/)

- **`app/admin/page.tsx`** (523 lines): `AdminPage [L503-L522]`
- **`app/admin/papers/page.tsx`** (42 lines): `AdminPapersPage [L26-L41]`
- **`app/api/admin/users/route.ts`** (557 lines): `ManagedUser [L13-L25]`, `GET [L52-L153]`, `POST [L159-L392]`, `PATCH [L399-L477]`, `DELETE [L483-L556]`
- **`app/api/ads/config/route.ts`** (129 lines): `GET [L59-L69]`, `POST [L71-L115]`, `DELETE [L117-L128]`
- **`app/api/ingest/crop/route.ts`** (146 lines): `POST [L50-L145]`
- **`app/api/ingest/extract/route.ts`** (347 lines): `POST [L45-L346]`
- **`app/api/ingest/publish/route.ts`** (484 lines): `PublishReceipt [L45-L53]`, `POST [L74-L483]`
- **`app/api/ingest/staged-paper/route.ts`** (1154 lines): `GET [L167-L730]`, `POST [L742-L1058]`, `DELETE [L1064-L1153]`
- **`app/api/ingest/verify-ms/route.ts`** (210 lines): `POST [L42-L209]`
- **`app/api/questions/delete/route.ts`** (115 lines): `POST [L23-L114]`
- **`app/api/questions/update/route.ts`** (171 lines): `POST [L23-L170]`
- **`app/homework/page.tsx`** (33 lines): `metadata [L5-L8]`, `HomeworkPage [L26-L32]`
- **`app/layout.tsx`** (95 lines): `metadata [L35-L38]`, `viewport [L40-L46]`, `RootLayout [L48-L94]`
- **`app/not-found.tsx`** (22 lines): `NotFound [L3-L21]`
- **`app/page.tsx`** (423 lines): `HomePage [L23-L422]`
- **`app/portal/compiler/print/page.tsx`** (224 lines): `PrintPage [L208-L223]`
- **`app/portal/page.tsx`** (994 lines): `PortalPage [L976-L993]`
- **`app/profile/homework/page.tsx`** (33 lines): `metadata [L5-L8]`, `ProfileHomeworkPage [L26-L32]`
- **`app/profile/page.tsx`** (34 lines): `metadata [L5-L9]`, `ProfilePage [L27-L33]`
- **`app/profile/review/page.tsx`** (34 lines): `metadata [L5-L9]`, `ProfileReviewPage [L27-L33]`
- **`app/profile/settings/page.tsx`** (34 lines): `metadata [L5-L9]`, `ProfileSettingsPage [L27-L33]`
- **`app/profile/stats/page.tsx`** (34 lines): `metadata [L5-L9]`, `ProfileStatsPage [L27-L33]`

## 2. UI & Portal Components (components/)

- **`components/AppShell.tsx`** (33 lines): `AppShell [L11-L30]`
- **`components/AuthModal.tsx`** (406 lines): `AuthModalProps [L15-L22]`, `AuthModal [L24-L403]`
- **`components/Header.tsx`** (312 lines): `Header [L19-L309]`
- **`components/LeaderboardModal.tsx`** (361 lines): `LeaderboardModal [L20-L360]`
- **`components/QuestionCard.tsx`** (907 lines): `QuestionCard [L36-L904]`
- **`components/RoundSummary.tsx`** (388 lines): `RoundSummary [L31-L385]`
- **`components/SoundToggle.tsx`** (64 lines): `SoundToggle [L12-L61]`
- **`components/StartFlow.tsx`** (990 lines): `StartFlow [L23-L987]`
- **`components/StudentAuthGate.tsx`** (212 lines): `StudentAuthGate [L14-L209]`
- **`components/TopicMasteryList.tsx`** (305 lines): `TopicMasteryList [L33-L302]`
- **`components/admin/AdminSettingsHub.tsx`** (1553 lines): `AdminSettingsHubProps [L36-L40]`, `AdminSettingsHub [L70-L1552]`
- **`components/admin/AdsManagerHub.tsx`** (2298 lines): `AdsManagerHub [L115-L2297]`
- **`components/admin/AppAdminHub.tsx`** (922 lines): `AppAdminHubProps [L31-L37]`, `AppAdminHub [L39-L387]`, `EducatorSeat [L389-L396]`, `InstitutionalCohort [L398-L404]`, `SchoolLicenceManager [L406-L921]`
- **`components/admin/AppAdminNav.tsx`** (334 lines): `AppAdminNavProps [L22-L32]`, `AppAdminNav [L34-L333]`
- **`components/admin/IngestionHistoryHub.tsx`** (1347 lines): `IngestionHistoryItem [L43-L54]`, `IngestionHistoryHubProps [L56-L59]`, `IngestionHistoryHub [L114-L1346]`
- **`components/admin/PortalMenuManager.tsx`** (529 lines): `PortalMenuManager [L69-L528]`
- **`components/admin/UserManagementHub.tsx`** (2247 lines): `ManagedUser [L53-L65]`, `UserManagementHub [L171-L2246]`
- **`components/admin/WholePaperViewer.tsx`** (1103 lines): `WholePaperViewer [L38-L1102]`
- **`components/ads/AdSlotBanner.tsx`** (769 lines): `AdSlotBannerProps [L23-L38]`, `AdSlotBanner [L74-L766]`
- **`components/portal/AdminCMS.tsx`** (1155 lines): `AdminCMSProps [L40-L43]`, `AdminCMS [L45-L1154]`
- **`components/portal/AdminNav.tsx`** (398 lines): `AdminNavProps [L25-L38]`, `AdminNav [L40-L397]`
- **`components/portal/AdminTools.tsx`** (2821 lines): `QuestionBankItem [L79-L105]`, `getStatusBadgeClass [L107-L120]`, `createInitialBankItems [L122-L212]`, `BankFilterDropdown [L246-L396]`, `AdminTools [L398-L2820]`
- **`components/portal/AssignedHomeworkHub.tsx`** (616 lines): `AssignedHomeworkHubProps [L38-L42]`, `AssignedHomeworkHub [L44-L615]`
- **`components/portal/AssignedHomeworkModal.tsx`** (871 lines): `NewHomeworkModal [L76-L618]`, `SubmissionsDetailModal [L630-L870]`
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
- **`components/portal/TeacherAnalytics.tsx`** (2565 lines): `TeacherAnalyticsProps [L61-L65]`, `RosterStudent [L67-L87]`, `HeatRow [L89-L92]`, `TeacherAnalytics [L202-L2564]`
- **`components/portal/TeacherOverviewHub.tsx`** (1784 lines): `TeacherOverviewHubProps [L57-L60]`, `TriageStudent [L62-L75]`, `MockAssignmentStats [L77-L81]`, `TeacherOverviewHub [L112-L1783]`
- **`components/portal/compiler/CompilerDiagramPreview.tsx`** (272 lines): `CompilerDiagramPreviewProps [L19-L25]`, `CompilerDiagramPreview [L34-L271]`
- **`components/portal/compiler/PrintableExamLayout.tsx`** (320 lines): `PrintableExamLayout [L14-L319]`
- **`components/portal/compiler/TestCompilerHub.tsx`** (3216 lines): `TestCompilerHub [L84-L3215]`
- **`components/portal/staged/StagedPaperAuditor.tsx`** (663 lines): `StagedPaperAuditorProps [L30-L34]`, `StagedPaperAuditor [L42-L660]`
- **`components/portal/staged/StagedPapersQueue.tsx`** (733 lines): `StagedPaperItem [L29-L46]`, `StagedPapersQueueProps [L48-L51]`, `StagedPapersQueue [L87-L732]`
- **`components/profile/StudentAchievementsActivityPanel.tsx`** (584 lines): `StudentAchievementsActivityPanelProps [L14-L20]`, `StudentAchievementsActivityPanel [L22-L583]`
- **`components/profile/StudentHomeworkPanel.tsx`** (1150 lines): `StudentHomeworkPanel [L111-L1149]`
- **`components/profile/StudentProfileHub.tsx`** (912 lines): `StudentProfileHub [L79-L911]`
- **`components/profile/StudentReviewPanel.tsx`** (768 lines): `StudentReviewPanelProps [L19-L25]`, `StudentReviewPanel [L27-L767]`
- **`components/profile/StudentSettingsPanel.tsx`** (717 lines): `StudentSettingsPanelProps [L31-L39]`, `StudentSettingsPanel [L59-L716]`
- **`components/profile/StudentStatsPanel.tsx`** (569 lines): `StudentStatsPanelProps [L7-L13]`, `StudentStatsPanel [L15-L568]`
- **`components/ui/MarkdownErrorBoundary.tsx`** (59 lines): `MarkdownErrorBoundary [L22-L56]`
- **`components/ui/RichMarkdown.tsx`** (103 lines): `neobrutalistTableComponents [L13-L34]`, `printableTableComponents [L36-L57]`, `RichMarkdownProps [L59-L64]`, `RichMarkdown [L66-L100]`
- **`components/ui/badge.tsx`** (47 lines): `Badge [L40-L44]`
- **`components/ui/dialog.tsx`** (131 lines): `DialogFooter [L81-L92]`, `Dialog [L119-L130]`, `DialogPortal [L119-L130]`, `DialogOverlay [L119-L130]`, `DialogClose [L119-L130]`
- **`components/ui/select.tsx`** (274 lines): `SelectOption [L5-L9]`, `SelectProps [L11-L29]`, `Select [L31-L270]`, `NeobrutalistDropdown [L272-L272]`
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
- **`lib/homework.ts`** (182 lines): `HomeworkSubmission [L7-L16]`, `getHomeworkSubmissions [L66-L76]`, `saveHomeworkSubmission [L81-L94]`, `getHomeworkAssignments [L100-L157]`, `findAssignmentByTestCode [L162-L181]`
- **`lib/ingestion/diagramCropper.ts`** (561 lines): `isDiagramBBoxValid [L30-L75]`, `normalizeBBox [L86-L135]`, `denormalizeBBox [L144-L173]`, `sanitizeDiagramFilename [L201-L211]`, `cropAndUploadImage [L326-L342]`
- **`lib/ingestion/geminiExtractor.ts`** (537 lines): `ExtractionProgress [L10-L17]`, `ExtractionOptions [L19-L26]`, `normalizeGeminiModel [L34-L49]`, `toBase64 [L51-L75]`, `extractQuestionsChunked [L124-L239]`
- **`lib/ingestion/katexSanitizer.ts`** (687 lines): `normalizeMathDelimiters [L125-L151]`, `escapeCurrencyDollars [L162-L246]`, `normalizeFractions [L268-L686]`, `normalizeGreekSymbols [L345-L408]`, `normalizeUnits [L421-L445]`
- **`lib/ingestion/markSchemeChecker.ts`** (268 lines): `MismatchType [L6-L13]`, `QuestionMismatch [L15-L27]`, `MarkSchemeVerificationReport [L31-L43]`, `checkQuestionAgainstMarkScheme [L48-L51]`, `verifyPaperAgainstMarkScheme [L187-L261]`
- **`lib/ingestion/markSchemeParser.ts`** (285 lines): `ParseMarkSchemeResult [L9-L15]`, `parseMarkSchemePdf [L23-L87]`, `parseMarkSchemeText [L96-L145]`, `findMarkSchemePdf [L157-L245]`
- **`lib/ingestion/markSchemeRemediator.ts`** (219 lines): `RemediationChange [L5-L10]`, `RemediationResult [L12-L17]`, `remediatePaperWithMarkScheme [L26-L136]`
- **`lib/ingestion/stagedPaperStorage.ts`** (502 lines): `fetchPersistentPaperStates [L31-L66]`, `savePersistentPaperStates [L68-L101]`, `getStagingLocations [L109-L143]`, `getFallbackStagingPaper [L145-L224]`, `fetchLiveSupabasePapers [L254-L356]`
- **`lib/ingestion/useIngestionStore.ts`** (1770 lines): `PublishReceipt [L17-L27]`, `IngestionState [L46-L86]`, `IngestionActions [L88-L157]`, `inferPaperMetadata [L239-L283]`, `normalizeStagingPayload [L294-L512]`
- **`lib/leaderboard.ts`** (46 lines): `LeaderboardEntry [L4-L11]`, `fetchWeeklyLeaderboard [L13-L32]`, `toggleLeaderboardOptIn [L34-L45]`
- **`lib/mastery.ts`** (251 lines): `getMasteryBadge [L46-L85]`, `getReviewPile [L117-L130]`, `addToReviewPile [L150-L164]`, `getFirstTryCorrectIds [L200-L213]`, `subscribeMasteryChanges [L237-L250]`
- **`lib/portal/assignedHomework.ts`** (303 lines): `AssignedHomeworkRound [L15-L40]`, `computeHomeworkMetrics [L72-L105]`, `getAssignedHomeworkByCode [L138-L164]`, `findHomeworkByIdAnyTeacher [L166-L193]`, `saveAssignedHomework [L195-L233]`
- **`lib/portal/bankFilters.ts`** (1087 lines): `parseCambridgePaperMetadata [L186-L300]`, `enrichBankQuestion [L461-L527]`, `filterBankQuestions [L539-L650]`, `computeBankFacetCounts [L669-L829]`, `parseBankFiltersFromQuery [L1025-L1086]`
- **`lib/portal/massActions.ts`** (386 lines): `BaseQuestionBankItem [L8-L18]`, `toggleSelectQuestion [L47-L58]`, `toggleSelectPage [L65-L80]`, `calculateClampedPage [L170-L183]`, `openMassActionModal [L305-L320]`
- **`lib/portal/menuConfig.ts`** (281 lines): `DEFAULT_PORTAL_NAV_ITEMS [L26-L107]`, `getPortalNavItems [L135-L160]`, `togglePortalMenuItem [L187-L198]`, `addPortalMenuItem [L220-L243]`, `removePortalMenuItem [L249-L264]`
- **`lib/portal/questionMetadata.ts`** (206 lines): `CambridgeQuestionMeta [L1-L17]`, `SUGGESTED_TAGS [L19-L28]`, `SUBJECT_OPTIONS [L42-L47]`, `formatCambridgeCitation [L58-L71]`, `parseCambridgeQuestionMetadata [L73-L205]`
- **`lib/questions.ts`** (1060 lines): `CAMBRIDGE_QUESTIONS [L47-L478]`, `mapDbQuestionToQuestion [L795-L843]`, `fetchQuestionsFromDb [L849-L930]`, `useQuestions [L978-L1011]`, `useTopics [L1024-L1057]`
- **`lib/resolveDiagramUrl.ts`** (32 lines): `resolveDiagramUrl [L6-L31]`
- **`lib/roster.ts`** (535 lines): `addRosterInvite [L53-L133]`, `getRosterInvites [L140-L182]`, `checkAndClaimInvite [L208-L272]`, `DEFAULT_TEACHER_CLASSES [L293-L349]`, `createTeacherClass [L375-L414]`
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
- **`scripts/verify-revizz.ts`** (4479 lines): `test [L211-L233]`, `testAsync [L235-L257]`, `assert [L259-L263]`
- **`scripts/verify-ui.ts`** (593 lines): `recordAssertion [L46-L62]`, `parseCliArgs [L71-L110]`, `resolveChromeExecutable [L113-L141]`
- **`scripts/wt.ts`** (1838 lines): `commandCreate [L380-L521]`, `commandRelease [L689-L811]`, `commandServe [L986-L1135]`, `commandShip [L1178-L1459]`, `main [L1679-L1829]`

## 5. Database & Supabase Migrations (supabase/)

- **`supabase/migrations/20261016_question_bank_filter_columns.sql`** (19 lines): `idx_questions_subject_id [L11-L11]`, `idx_questions_topic_id [L12-L12]`, `idx_questions_active [L13-L13]`
