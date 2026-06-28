import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
} from "@azure/storage-blob"

// Azure Blob Storage — replaces Supabase Storage. Containers are private; read
// access is granted via short-lived SAS URLs minted server-side (see getSasUrl).

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING

export const CONTAINERS = {
  templates: process.env.AZURE_STORAGE_TEMPLATES_CONTAINER ?? "templates",
  photos: process.env.AZURE_STORAGE_PHOTOS_CONTAINER ?? "photos",
} as const

export type BucketName = keyof typeof CONTAINERS

let serviceClient: BlobServiceClient | null = null

function getService(): BlobServiceClient {
  if (!CONNECTION_STRING) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured")
  }
  if (!serviceClient) {
    serviceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING)
  }
  return serviceClient
}

function parseCredential(): { accountName: string; credential: StorageSharedKeyCredential } {
  // Parse AccountName / AccountKey from the connection string for SAS signing.
  const parts = Object.fromEntries(
    (CONNECTION_STRING ?? "")
      .split(";")
      .map((kv) => {
        const idx = kv.indexOf("=")
        return idx === -1 ? [kv, ""] : [kv.slice(0, idx), kv.slice(idx + 1)]
      })
  ) as Record<string, string>

  const accountName = parts.AccountName
  const accountKey = parts.AccountKey
  if (!accountName || !accountKey) {
    throw new Error("Connection string missing AccountName/AccountKey for SAS")
  }
  return {
    accountName,
    credential: new StorageSharedKeyCredential(accountName, accountKey),
  }
}

// Uploads a file and returns its storage path in the form "<container>/<blob>",
// matching the previous Supabase path convention used throughout the app.
export async function uploadFile(
  bucket: BucketName,
  blobName: string,
  data: Buffer | ArrayBuffer | Uint8Array,
  contentType: string
): Promise<string> {
  const container = getService().getContainerClient(CONTAINERS[bucket])
  const blob = container.getBlockBlobClient(blobName)
  const buffer = data instanceof Buffer ? data : Buffer.from(data as ArrayBuffer)
  await blob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  })
  return `${bucket}/${blobName}`
}

// Mints a short-lived read-only SAS URL for a stored path ("<container>/<blob>"
// or "<blob>" with an explicit bucket). Default lifetime: 1 hour.
export function getSasUrl(
  storagePath: string,
  expiresInSeconds = 3600
): string {
  const { bucket, blobName } = splitPath(storagePath)
  const { accountName, credential } = parseCredential()

  const now = Date.now()
  const sas = generateBlobSASQueryParameters(
    {
      containerName: CONTAINERS[bucket],
      blobName,
      permissions: BlobSASPermissions.parse("r"),
      protocol: SASProtocol.Https,
      startsOn: new Date(now - 5 * 60 * 1000), // 5 min clock skew
      expiresOn: new Date(now + expiresInSeconds * 1000),
    },
    credential
  ).toString()

  return `https://${accountName}.blob.core.windows.net/${CONTAINERS[bucket]}/${encodeURIComponent(
    blobName
  ).replace(/%2F/g, "/")}?${sas}`
}

// Accepts either "<bucket>/<blob...>" or a bare blob name (defaults to photos).
function splitPath(storagePath: string): { bucket: BucketName; blobName: string } {
  const slash = storagePath.indexOf("/")
  if (slash !== -1) {
    const maybeBucket = storagePath.slice(0, slash)
    if (maybeBucket === "templates" || maybeBucket === "photos") {
      return { bucket: maybeBucket, blobName: storagePath.slice(slash + 1) }
    }
  }
  return { bucket: "photos", blobName: storagePath }
}
