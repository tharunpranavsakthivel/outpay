import { getStoreLogoObject } from "@/lib/dashboard/server";

/**
 * Streams a store logo asset. Each asset ID is unique per upload, so the
 * response can be cached forever.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  const asset = await getStoreLogoObject(assetId);

  if (!asset) {
    return new Response(null, { status: 404 });
  }

  return new Response(Buffer.from(asset.buffer), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": asset.contentType,
    },
  });
}
