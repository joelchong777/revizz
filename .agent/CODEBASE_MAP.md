# Revizz Codebase Atlas & Line Coordinates

> **Automated Symbol Atlas**: Indexing 82 files, 37,308 lines, and 336 symbols across core modules. Generated in 183ms.

Use `npx tsx scripts/codebase-map.ts query <term>` to search symbols with exact `[L<start>-L<end>]` coordinates.

## 1. App Router Pages & API Endpoints (app/)

- **`app/admin/page.tsx`** (509 lines) — *Admin dashboard portal page for question management & paper ingestion*: `AdminPage [L489-L508]`
- **`app/api/ingest/crop/route.ts`** (146 lines) — *API route for diagram bounding box cropping from PDF pages*: `POST [L50-L145]`
- **`app/api/ingest/extract/route.ts`** (347 lines) — *API route for Gemini paper extraction and question parsing*: `runtime [L4-L4]`, `dynamic [L5-L5]`, `maxDuration [L6-L6]`, `POST [L45-L346]`
- **`app/api/ingest/publish/route.ts`** (471 lines) — *API route for publishing staged questions into Supabase*: `PublishReceipt [L45-L52]`, `POST [L73-L470]`
- **`app/api/ingest/staged-paper/route.ts`** (162 lines) — *API route for staged paper metadata and question retrieval*: `GET [L14-L161]`
- **`app/layout.tsx`** (95 lines) — *Root layout with neobrutalist aesthetic, fonts, and theme providers*: `metadata [L35-L38]`, `viewport [L40-L46]`, `RootLayout [L48-L94]`
- **`app/not-found.tsx`** (22 lines) — *Custom 404 error page with playful neobrutalist styling*: `NotFound [L3-L21]`
- **`app/page.tsx`** (180 lines) — *Revizz student home page and interactive quiz game launchpad*: `HomePage [L16-L179]`
- **`app/portal/compiler/print/page.tsx`** (105 lines) — *Printable Cambridge exam layout page with bubble sheets*: `PrintPage [L98-L104]`
- **`app/portal/page.tsx`** (950 lines) — *Teacher and student portal hub with tabs and analytics*: `PortalPage [L932-L949]`

## 2. UI & Portal Components (components/)

- **`components/AppShell.tsx`** (30 lines) — *Application shell layout with responsive container rules*: `AppShell [L11-L27]`
- **`components/Header.tsx`** (438 lines) — *Global header with user profile, streak multiplier, and XP counter*: `Header [L18-L435]`
- **`components/LeaderboardModal.tsx`** (106 lines) — *Global student XP rankings and school leaderboard modal*: `LeaderboardModal [L17-L105]`
- **`components/QuestionCard.tsx`** (730 lines) — *Tactile 3D neobrutalist question card with markdown and KaTeX math*: `QuestionCard [L32-L727]`
- **`components/RoundSummary.tsx`** (284 lines) — *End-of-round quiz recap showing XP awarded, accuracy, and review pile*: `RoundSummary [L26-L281]`
- **`components/SoundToggle.tsx`** (64 lines) — *Audio sound effects toggle control with tactile spring physics*: `SoundToggle [L12-L61]`
- **`components/StartFlow.tsx`** (435 lines) — *Interactive topic selector and game launch controller*: `StartFlow [L32-L432]`
- **`components/TopicMasteryList.tsx`** (215 lines) — *Student syllabus progress tracker and topic mastery tiers*: `TopicMasteryList [L32-L212]`
- **`components/admin/AppAdminHub.tsx`** (602 lines) — *App admin control hub isolating developer tools from teachers*: `AppAdminHubProps [L25-L30]`, `AppAdminHub [L32-L601]`
- **`components/admin/AppAdminNav.tsx`** (314 lines) — *Admin navigation bar with tab switching*: `AppAdminNavProps [L19-L26]`, `AppAdminNav [L28-L313]`
- **`components/portal/AdminCMS.tsx`** (517 lines) — *Question bank CMS table with filtering, search, and inline editor*: `AdminCMSProps [L21-L24]`, `AdminCMS [L26-L516]`
- **`components/portal/AdminNav.tsx`** (378 lines) — *Portal navigation bar with school badge and mode indicator*: `AdminNavProps [L20-L32]`, `AdminNav [L34-L377]`
- **`components/portal/AdminTools.tsx`** (912 lines) — *Question audit and management tools for administrators*: `AdminToolsProps [L24-L27]`, `AdminTools [L132-L911]`
- **`components/portal/IngestionAuditDrawer.tsx`** (1323 lines) — *Drawer component for inspecting and auditing question JSON/images*: `IngestionAuditDrawerProps [L28-L34]`, `AuditStatus [L36-L36]`, `AuditIssue [L38-L43]`, `QuestionAuditResult [L45-L54]`, `QualityGateCheckItem [L56-L64]`, `IngestionAuditDrawer [L1322-L1322]`
- **`components/portal/IngestionDiagnostics.tsx`** (1001 lines) — *System diagnostic tools for Cambridge exam ingestion pipeline*: `DiagnosticStatus [L31-L31]`, `DiagnosticCheckItem [L33-L42]`, `KaTeXIssue [L44-L51]`, `IngestionDiagnosticsProps [L53-L58]`, `lintKaTeXContent [L68-L220]`, `IngestionDiagnostics [L222-L998]`
- **`components/portal/IngestionHeader.tsx`** (346 lines) — *Ingestion studio progress header with batch controls*: `IngestionHeaderProps [L19-L54]`, `IngestionHeader [L56-L345]`
- **`components/portal/IngestionHub.tsx`** (474 lines) — *Cambridge exam ingestion studio frame and workflow selector*: `IngestionHub [L18-L473]`
- **`components/portal/IngestionLivePreview.tsx`** (688 lines) — *Live preview pane rendering extracted questions with math/diagrams*: `IngestionLivePreviewProps [L32-L38]`, `IngestionLivePreview [L40-L685]`
- **`components/portal/IngestionMediaPanel.tsx`** (870 lines) — *High-resolution PDF diagram cropper and media asset panel*: `IngestionMediaPanelProps [L34-L66]`, `IngestionMediaPanel [L68-L867]`
- **`components/portal/IngestionModals.tsx`** (1079 lines) — *Dialogs for raw SQL viewer, JSON inspection, and confirmation*: `IngestionModalsProps [L28-L37]`, `IngestionSettingsModalProps [L39-L44]`, `IngestionPayloadModalProps [L46-L52]`, `generatePostgresUpsertSql [L62-L1078]`
- **`components/portal/IngestionOptionsEditor.tsx`** (420 lines) — *Interactive 4-option editor with correct-answer toggles and math*: `IngestionOptionsEditorProps [L23-L33]`, `IngestionOptionsEditor [L65-L417]`
- **`components/portal/IngestionPdfViewer.tsx`** (818 lines) — *PDF viewer with zoom, page navigation, and crop coordinate overlay*: `IngestionPdfViewerProps [L27-L54]`, `IngestionPdfViewer [L73-L815]`
- **`components/portal/IngestionPreviewModal.tsx`** (424 lines) — *Full-screen review modal for inspecting questions before database sync*: `IngestionPreviewModalProps [L27-L34]`, `IngestionPreviewModal [L36-L423]`
- **`components/portal/IngestionQuestionEditor.tsx`** (313 lines) — *Question editor form for stem markdown, topic tagging, and citation*: `IngestionQuestionEditorProps [L14-L23]`, `IngestionQuestionEditor [L25-L310]`
- **`components/portal/IngestionQuestionNav.tsx`** (619 lines) — *Thumbnail sidebar navigation for questions with validation badges*: `IngestionQuestionNavProps [L19-L32]`, `FilterTabMode [L34-L34]`, `QuestionStatusItem [L36-L45]`, `hasKaTeXSyntaxError [L50-L73]`, `getQuestionValidation [L83-L86]`, `hasDiagram [L127-L135]`, `evaluateQuestionStatus [L144-L195]`, `IngestionQuestionNav [L197-L616]`
- **`components/portal/IngestionSetupWizard.tsx`** (1222 lines) — *Multi-step setup wizard for PDF upload and Gemini workflow selection*: `SubjectPreset [L27-L31]`, `StagedPaperSummary [L33-L40]`, `CAMBRIDGE_SUBJECT_PRESETS [L42-L52]`, `IngestionSetupWizardProps [L54-L87]`, `IngestionSetupWizard [L94-L1221]`
- **`components/portal/IngestionStemEditor.tsx`** (896 lines) — *Markdown editor for question stems with KaTeX preview*: `IngestionStemEditorProps [L34-L48]`, `KatexSyntaxIssue [L50-L54]`, `detectKatexErrors [L59-L66]`, `IngestionStemEditor [L198-L893]`
- **`components/portal/IngestionStudioFrame.tsx`** (56 lines) — *Outer layout container for the Cambridge ingestion studio*: `IngestionStudioFrameProps [L5-L12]`, `IngestionStudioFrame [L20-L53]`
- **`components/portal/IngestionWorkspace.tsx`** (317 lines) — *Split-pane workspace coordinating PDF view and question editor*: `IngestionWorkspaceProps [L17-L41]`, `IngestionWorkspace [L53-L314]`
- **`components/portal/StagingReview.tsx`** (424 lines) — *Review interface for staged batch questions awaiting production release*: `StagingReview [L73-L423]`
- **`components/portal/TeacherAnalytics.tsx`** (745 lines) — *Teacher analytics dashboard for student accuracy and distractor metrics*: `TeacherAnalyticsProps [L23-L26]`, `RosterStudent [L28-L41]`, `HeatRow [L43-L46]`, `TeacherAnalytics [L48-L744]`
- **`components/portal/compiler/PrintableExamLayout.tsx`** (215 lines) — *Printable Cambridge exam format layout with cover page & mark scheme*: `PrintableExamLayout [L15-L214]`
- **`components/portal/compiler/TestCompilerHub.tsx`** (1004 lines) — *Teacher test compiler builder for custom exams, filters, and drafts*: `TestCompilerHub [L38-L1003]`
- **`components/ui/MarkdownErrorBoundary.tsx`** (59 lines) — *Defensive React error boundary isolating math/markdown render failures*: `MarkdownErrorBoundary [L22-L56]`
- **`components/ui/badge.tsx`** (47 lines) — *Neobrutalist badge component with colored borders and soft shadows*: `BadgeProps [L36-L38]`, `Badge [L40-L44]`, `badgeVariants [L46-L46]`
- **`components/ui/dialog.tsx`** (131 lines) — *Accessible modal dialog wrapper using Radix UI primitives*: `DialogHeader [L70-L78]`, `DialogFooter [L81-L92]`, `Dialog [L119-L130]`, `DialogPortal [L119-L130]`, `DialogOverlay [L119-L130]`, `DialogClose [L119-L130]`, `DialogTrigger [L119-L130]`, `DialogContent [L119-L130]`, `DialogTitle [L119-L130]`, `DialogDescription [L119-L130]`
- **`components/ui/select.tsx`** (236 lines) — *Accessible dropdown select menu wrapper using Radix UI primitives*: `SelectOption [L5-L9]`, `SelectProps [L11-L28]`, `Select [L30-L232]`, `NeobrutalistDropdown [L234-L234]`
- **`components/ui/tabs.tsx`** (57 lines) — *Tab navigation component with accessible keyboard switching*: `Tabs [L56-L56]`, `TabsList [L56-L56]`, `TabsTrigger [L56-L56]`, `TabsContent [L56-L56]`

## 3. Core Libraries, State, Hooks & Ingestion Engine (lib/, hooks/)

- **`hooks/useQuizGame.ts`** (395 lines) — *Core quiz game loop, scoring, timer, and attempt persistence hook*: `Question [L13-L29]`, `QuizRoundConfig [L31-L37]`, `GameState [L39-L39]`, `QuestionStatus [L41-L41]`, `MissedQuestionItem [L43-L47]`, `useQuizGame [L49-L393]`
- **`lib/agentBlackboard.ts`** (349 lines) — *Agent coordination blackboard for multi-agent task sharing*: `WorkerStatus [L4-L4]`, `WorkerInfo [L6-L12]`, `WorktreeInfo [L14-L19]`, `BlackboardState [L21-L27]`, `getBlackboardFilePath [L33-L54]`, `createDefaultBlackboard [L59-L70]`, `getBlackboard [L153-L182]`, `updateBlackboard [L187-L224]`, `registerWorker [L229-L240]`, `updateWorkerStatus [L245-L271]`, `resetBlackboard [L276-L282]`, `registerWorktree [L287-L299]`, `removeWorktree [L304-L318]`, `setSharedData [L323-L329]`, `getSharedData [L334-L337]`, `setPort [L342-L348]`
- **`lib/audio.ts`** (246 lines) — *Tactile sound effect synthesizer using Web Audio API*: `isSoundEnabled [L42-L49]`, `setSoundEnabled [L51-L65]`, `toggleSound [L67-L71]`, `subscribeSoundState [L73-L78]`, `playPop [L99-L126]`, `playChime [L131-L166]`, `playBuzzer [L171-L203]`, `playFanfare [L208-L245]`
- **`lib/auth.ts`** (390 lines) — *Authentication state, user sanitization, and school account tagging*: `PROVIDER_NOT_ENABLED_CODE [L5-L5]`, `AuthCustomError [L7-L11]`, `SignInOptions [L13-L18]`, `isProviderNotEnabledError [L24-L54]`, `normalizeAuthError [L59-L117]`, `signInWithGoogle [L123-L159]`, `GUEST_EDUCATOR_STORAGE_KEY [L161-L161]`, `DEFAULT_GUEST_EDUCATOR_PROFILE [L163-L172]`, `getGuestEducatorSession [L184-L195]`, `setGuestEducatorSession [L197-L210]`, `clearGuestEducatorSession [L212-L225]`, `signInAsGuestEducator [L230-L237]`, `signOut [L239-L243]`, `formatDisplayName [L245-L254]`, `checkIsSchoolAccount [L256-L258]`, `useAuth [L260-L389]`
- **`lib/barcode.tsx`** (118 lines) — *Code 128 barcode generator component for printed exam papers*: `encodeCode128B [L20-L38]`, `generateCode128Bars [L40-L40]`, `Code128Barcode [L63-L117]`
- **`lib/compilerFilters.ts`** (227 lines) — *Search, filter, and sort algorithms for teacher test compiler*: `SelectionFilter [L3-L3]`, `SortOption [L4-L4]`, `CompilerFilterOptions [L6-L16]`, `extractSeriesOrYear [L25-L77]`, `hasDataTable [L82-L85]`, `isMathOrCalculation [L90-L113]`, `getAvailableSeries [L118-L127]`, `filterAndSortQuestions [L132-L208]`, `countActiveFilters [L213-L226]`
- **`lib/ingestion/diagramCropper.ts`** (561 lines) — *Client-side interface for PDF diagram bounding-box cropping*: `DiagramBBox [L9-L15]`, `CropResult [L17-L23]`, `isDiagramBBoxValid [L30-L75]`, `normalizeBBox [L86-L135]`, `denormalizeBBox [L144-L173]`, `getCropPixelCoordinates [L179-L184]`, `sanitizeDiagramFilename [L201-L211]`, `cropImageBuffer [L216-L220]`, `uploadDiagramToStorage [L245-L249]`, `cropAndUploadImage [L326-L342]`, `cropAndUploadDiagram [L425-L430]`, `batchCropDiagrams [L544-L551]`
- **`lib/ingestion/geminiExtractor.ts`** (537 lines) — *Gemini 3.8 Flash multimodal API client with backoff and batching*: `ExtractionProgress [L10-L17]`, `ExtractionOptions [L19-L26]`, `normalizeGeminiModel [L34-L49]`, `toBase64 [L51-L75]`, `isTransientCapacityError [L97-L97]`, `extractQuestionsChunked [L124-L239]`
- **`lib/ingestion/katexSanitizer.ts`** (575 lines) — *Sanitization utility fixing Cambridge math LaTeX syntax errors*: `normalizeMathDelimiters [L23-L40]`, `escapeCurrencyDollars [L51-L135]`, `fixEscapedBackslashes [L141-L146]`, `normalizeFractions [L157-L574]`, `normalizeExponentsAndSubscripts [L199-L212]`, `normalizeGreekSymbols [L234-L297]`, `normalizeUnits [L310-L334]`, `sanitizeKaTeX [L413-L435]`, `validateKaTeXSyntax [L465-L465]`
- **`lib/ingestion/useIngestionStore.ts`** (1355 lines) — *Zustand persistent store for paper ingestion workspace state*: `PublishStatus [L13-L13]`, `StatusFilter [L14-L14]`, `ExtractionProgress [L16-L21]`, `IngestionState [L23-L57]`, `IngestionActions [L59-L117]`, `IngestionStore [L119-L121]`, `useIngestionStore [L1338-L1343]`, `ingestionStore [L1348-L1354]`
- **`lib/leaderboard.ts`** (46 lines) — *Leaderboard ranking calculation and score persistence*: `LeaderboardEntry [L4-L11]`, `fetchWeeklyLeaderboard [L13-L32]`, `toggleLeaderboardOptIn [L34-L45]`
- **`lib/mastery.ts`** (251 lines) — *Leitner review pile storage and topic mastery tier thresholds*: `REVIEW_PILE_KEY [L10-L10]`, `FIRST_TRY_CORRECT_KEY [L11-L11]`, `MasteryTier [L13-L13]`, `MasteryBadge [L15-L24]`, `ReviewPileEntry [L26-L30]`, `ReviewPileMap [L32-L32]`, `getMasteryTier [L40-L44]`, `getMasteryBadge [L46-L85]`, `calculateMasteryPercentage [L91-L98]`, `getReviewPile [L117-L130]`, `getReviewPileIds [L135-L138]`, `getReviewPileCount [L143-L145]`, `addToReviewPile [L150-L164]`, `resolveFromReviewPile [L169-L181]`, `clearReviewPile [L186-L194]`, `getFirstTryCorrectIds [L200-L213]`, `recordFirstTryCorrect [L218-L230]`, `isFirstTryCorrect [L232-L235]`, `subscribeMasteryChanges [L237-L250]`
- **`lib/questions.ts`** (502 lines) — *Cambridge 0455 Economics question bank and topic definitions*: `SyllabusTopic [L4-L8]`, `CAMBRIDGE_TOPICS [L10-L41]`, `CAMBRIDGE_QUESTIONS [L43-L474]`, `getAllQuestions [L476-L478]`, `getQuestionsForTopic [L480-L482]`, `getQuestionsByIds [L484-L487]`, `shuffleQuestions [L493-L500]`
- **`lib/scoring.ts`** (98 lines) — *Scoring rules, streak multipliers (1.0x-1.5x), and XP math*: `BASE_QUESTION_XP [L14-L14]`, `RETRY_CORRECT_XP [L15-L15]`, `WRONG_XP [L16-L16]`, `TIMEOUT_XP [L17-L17]`, `AttemptOutcome [L19-L24]`, `ScoreCalculation [L26-L31]`, `getStreakMultiplier [L39-L43]`, `calculateAttemptScore [L48-L97]`
- **`lib/supabaseClient.ts`** (7 lines) — *Supabase client configuration and anonymous fallback*: `supabase [L6-L6]`
- **`lib/sync.ts`** (94 lines) — *Offline attempt queue and background Supabase synchronization*: `syncGuestDataToUser [L4-L93]`
- **`lib/testCompiler.ts`** (84 lines) — *Test compiler draft persistence in localStorage and exam compiler*: `saveTestDraft [L6-L9]`, `loadTestDraft [L11-L20]`, `listTestDrafts [L22-L37]`, `buildCompiledQuestions [L39-L67]`, `autoSelectQuestions [L69-L83]`
- **`lib/utils.ts`** (7 lines) — *Tailwind CSS class merging utility with clsx and twMerge*: `cn [L4-L6]`

## 4. Automation & Verification CLI Scripts (scripts/)

- **`scripts/agent-memory.ts`** (1179 lines) — *Agent memory engine indexing learnings, rules, and reflections*: `RuleCategory [L17-L22]`, `RuleItem [L24-L35]`, `ReflectionEntry [L37-L49]`, `SearchResult [L51-L56]`, `SearchOptions [L58-L62]`, `MemoryStats [L64-L72]`, `DEFAULT_MEMORY_PATH [L78-L86]`, `c [L96-L114]`, `extractRulesAndTraps [L540-L543]`
- **`scripts/aggregate-0455-m24-12.ts`** (129 lines) — *CLI script aggregating March 2024 paper 12 questions into JSON*: `aggregatePaper [L18-L18]`
- **`scripts/aggregate-0455-s24-12.ts`** (314 lines) — *CLI script aggregating Summer 2024 paper 12 questions into JSON*: `aggregatePaper [L39-L39]`
- **`scripts/blackboard.ts`** (211 lines) — *CLI interface for multi-agent blackboard state inspection*: `printHelp [L17-L52]`, `parseJsonOrString [L54-L60]`, `main [L62-L208]`
- **`scripts/codebase-map.ts`** (1191 lines) — *Ultra-fast (<200ms), zero-dependency TypeScript/Python/SQL symbol & line-range indexer.*: `SymbolKind [L23-L36]`, `SymbolInfo [L38-L45]`, `FileCategory [L47-L47]`, `FileMapEntry [L49-L55]`, `CodebaseIndex [L57-L68]`, `discoverFiles [L187-L216]`, `extractPurpose [L222-L1190]`
- **`scripts/crop_box.py`** (232 lines) — *PyMuPDF 300 DPI high-resolution diagram cropper CLI*: `normalize_coordinates [L26-L48]`, `crop_diagram [L51-L60]`, `main [L161-L227]`
- **`scripts/fast-ingest.py`** (853 lines) — *Fast multimodal Gemini ingestion pipeline with bounding box cropping*: `escape_currency_dollars [L96-L132]`, `parse_filename_metadata [L135-L176]`, `parse_mark_scheme [L179-L208]`, `map_syllabus_topic [L211-L232]`, `generate_explanation [L235-L240]`, `render_diagram_crop [L275-L279]`, `extract_questions_from_qp [L296-L302]`, `assemble_staging_paper [L644-L649]`, `ingest_single_paper [L692-L698]`, `find_matching_ms [L744-L763]`, `ingest_batch_directory [L766-L771]`, `main [L809-L848]`
- **`scripts/generate-upsert-sql.ts`** (125 lines) — *Generates SQL upsert queries for Cambridge questions into Supabase*: `generateQuestionSql [L54-L100]`
- **`scripts/ingest-paper.ts`** (669 lines) — *End-to-end paper ingestion coordinator script*: `CliOptions [L69-L84]`, `parseCliArgs [L86-L137]`, `InferredMetadata [L155-L164]`, `inferCambridgeMetadata [L170-L214]`, `upsertStagingPaperToSupabase [L224-L233]`
- **`scripts/verify-diagram-cropper.ts`** (128 lines) — *Verification test suite for PDF diagram cropper script*: `runTests [L6-L122]`
- **`scripts/verify-ingestion-nav.ts`** (102 lines) — *Verification tests for ingestion studio question navigation*: `assert [L8-L14]`
- **`scripts/verify-ingestion-v2.ts`** (845 lines) — *Verification suite for ingestion studio v2 features*: `assert [L43-L52]`, `createDummyQuestion [L54-L77]`, `createDummyPaper [L79-L104]`, `extractDistractorReasoning [L109-L123]`
- **`scripts/verify-ingestion.ts`** (531 lines) — *Verification suite for Gemini question extraction*: `assert [L23-L31]`, `createDummyQuestion [L33-L49]`, `createDummyPaper [L51-L68]`, `extractDistractorReasoning [L73-L87]`
- **`scripts/verify-revizz.ts`** (996 lines) — *Master Revizz QA and gameplay test suite with 56 assertions*: `test [L90-L102]`, `assert [L104-L108]`, `assertEqual [L110-L114]`
- **`scripts/verify-ui.ts`** (589 lines) — *Headless browser UI tests for neobrutalist components*: `recordAssertion [L42-L58]`, `parseCliArgs [L67-L106]`, `resolveChromeExecutable [L109-L137]`, `attachErrorListeners [L147-L188]`, `runVerifier [L191-L585]`
- **`scripts/wt.ts`** (1576 lines) — *Git worktree isolation manager and atomic release CLI*: `WorktreeInfo [L61-L70]`, `ResolvedWorktree [L72-L77]`, `getRepoRoot [L80-L87]`, `isSymlink [L89-L96]`, `getTimestamp [L98-L105]`, `sanitizeTopic [L107-L112]`, `parseWorktrees [L114-L194]`, `resolveWorktree [L196-L265]`, `verifyGitignore [L267-L318]`, `syncAgentTooling [L320-L370]`, `commandCreate [L377-L475]`, `commandList [L480-L515]`, `commandVerify [L520-L600]`, `commandRelease [L605-L748]`, `commandClean [L753-L873]`, `listWorktrees [L876-L876]`, `resolveTargetWorktree [L877-L877]`, `stopServerOnPort [L884-L917]`, `commandServe [L923-L1079]`, `commandStop [L1085-L1115]`, `commandShip [L1122-L1378]`, `commandHelp [L1383-L1462]`, `main [L1465-L1567]`

## 5. Database & Supabase Migrations (supabase/)

*(No files currently present in `supabase/`)*
