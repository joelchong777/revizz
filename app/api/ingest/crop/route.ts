import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DiagramBBox,
  isDiagramBBoxValid,
  normalizeBBox,
  cropAndUploadImage,
  sanitizeDiagramFilename,
} from '@/lib/ingestion/diagramCropper';

// Polyfill WebSocket in Node runtime if absent
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dmvahcaxixvhgxidmkqs.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * POST /api/ingest/crop
 *
 * Request body:
 * {
 *   imageBase64?: string;
 *   imageUrl?: string;
 *   bbox: DiagramBBox;
 *   paperCode: string;
 *   questionNumber: number;
 * }
 *
 * Validates coordinates, crops image/diagram, and returns:
 * {
 *   success: true;
 *   url: string;
 *   storage_path?: string;
 *   bbox: DiagramBBox;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const { imageBase64, imageUrl, bbox, paperCode, questionNumber } = body || {};

    // 1. Validate required fields
    if (!paperCode || typeof paperCode !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "paperCode".' },
        { status: 400 }
      );
    }

    if (
      questionNumber === undefined ||
      typeof questionNumber !== 'number' ||
      isNaN(questionNumber) ||
      questionNumber <= 0
    ) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "questionNumber" (must be positive number).' },
        { status: 400 }
      );
    }

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Either "imageBase64" or "imageUrl" must be provided.' },
        { status: 400 }
      );
    }

    // 2. Validate bounding box coordinates
    if (!isDiagramBBoxValid(bbox)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid, degenerate, or missing bounding box coordinates.',
          bbox: bbox ?? null,
        },
        { status: 400 }
      );
    }

    // 3. Format destination filename
    const cleanPaper = paperCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const qPad = String(questionNumber).padStart(2, '0');
    const targetFilename = sanitizeDiagramFilename(`${cleanPaper}_q${qPad}.png`);

    // 4. Crop image and upload to Supabase Storage (with fallback)
    const supabaseClient = getSupabaseClient();
    const result = await cropAndUploadImage({
      imageBase64,
      imageUrl,
      bbox: bbox as DiagramBBox,
      targetFilename,
      supabaseClient,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to crop diagram.',
        },
        { status: 500 }
      );
    }

    // 5. Return success response
    return NextResponse.json({
      success: true,
      url: result.url,
      storage_path: result.storage_path,
      bbox: normalizeBBox(bbox as DiagramBBox, 1000),
    });
  } catch (error: any) {
    console.error('[crop/route] Unhandled error during diagram cropping:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error during diagram cropping.',
      },
      { status: 500 }
    );
  }
}
