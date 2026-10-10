import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { validateStagingPaper } from '@/types/ingestion';

/**
 * GET /api/ingest/staged-paper
 * 
 * Query parameters:
 * - `id` (optional): Clean ID or filename of the staged paper (e.g. `0455_s24_12` or `0455_s24_12.json`).
 *   If provided: Reads `staging/${cleanId}.json`, validates with `validateStagingPaper`, and returns `{ success: true, paper }`.
 *   If omitted: Lists all available `.json` files in `staging/` and returns `{ success: true, papers: [...] }`.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawId = searchParams.get('id');

    const stagingDir = path.resolve(process.cwd(), 'staging');

    // Check if staging directory exists
    if (!fs.existsSync(stagingDir)) {
      if (rawId) {
        return NextResponse.json(
          { success: false, error: 'Staging directory not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, papers: [] });
    }

    // Scenario 1: Specific paper requested by ID
    if (rawId) {
      // Sanitize input to prevent directory traversal
      const cleanId = path.basename(rawId).replace(/\.json$/i, '').trim();

      if (!cleanId || !/^[a-zA-Z0-9_\-]+$/.test(cleanId)) {
        return NextResponse.json(
          { success: false, error: `Invalid paper ID: "${rawId}"` },
          { status: 400 }
        );
      }

      const filePath = path.join(stagingDir, `${cleanId}.json`);

      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { success: false, error: `Staged paper "${cleanId}" not found in staging directory.` },
          { status: 404 }
        );
      }

      let fileContent: string;
      try {
        fileContent = fs.readFileSync(filePath, 'utf8');
      } catch (readErr: any) {
        return NextResponse.json(
          { success: false, error: `Failed to read file for "${cleanId}": ${readErr?.message}` },
          { status: 500 }
        );
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(fileContent);
      } catch (jsonErr: any) {
        return NextResponse.json(
          { success: false, error: `Corrupted JSON in "${cleanId}.json": ${jsonErr?.message}` },
          { status: 500 }
        );
      }

      // Validate paper against schema and business rules (allowing partial/custom batches e.g. 30/40 questions)
      const validation = validateStagingPaper(parsedJson, { allowPartialBatch: true });
      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: `Staged paper "${cleanId}" failed schema validation.`,
            details: validation.errors,
          },
          { status: 422 }
        );
      }

      return NextResponse.json({
        success: true,
        paper: validation.data,
      });
    }

    // Scenario 2: List all available staged JSON papers
    const entries = fs.readdirSync(stagingDir, { withFileTypes: true });
    const papers = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => entry.name.replace(/\.json$/i, ''))
      .sort();

    return NextResponse.json({
      success: true,
      papers,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error while processing staged paper.',
      },
      { status: 500 }
    );
  }
}
