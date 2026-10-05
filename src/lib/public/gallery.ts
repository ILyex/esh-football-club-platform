import "server-only";
import { db } from "@/lib/db";
import { AlbumCategory } from "@prisma/client";

// ============================================================================
// PUBLIC GALLERY DATA ACCESS
// ----------------------------------------------------------------------------
// Strictly projects published albums and public media URLs.
// Excludes internal storage keys and draft/unpublished albums.
// ============================================================================

export interface PublicMediaItem {
  id: string;
  url: string;
  caption: string | null;
  order: number;
}

export interface PublicAlbumItem {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  category: AlbumCategory;
  createdAt: Date;
  photoCount: number;
  samplePhotos: PublicMediaItem[];
}

export interface PublicAlbumDetail extends PublicAlbumItem {
  photos: PublicMediaItem[];
}

export async function getPublicAlbums(): Promise<PublicAlbumItem[]> {
  const albums = await db.album.findMany({
    where: { published: true },
    select: {
      id: true,
      name: true,
      description: true,
      coverImageUrl: true,
      category: true,
      createdAt: true,
      media: {
        select: {
          id: true,
          url: true,
          caption: true,
          order: true
        },
        orderBy: { order: "asc" },
        take: 4
      },
      _count: {
        select: { media: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return albums.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    coverImageUrl: a.coverImageUrl || a.media[0]?.url || "/branding/esh-logo-256.png",
    category: a.category,
    createdAt: a.createdAt,
    photoCount: a._count.media,
    samplePhotos: a.media
  }));
}

export async function getPublicAlbumDetail(id: string): Promise<PublicAlbumDetail | null> {
  const album = await db.album.findFirst({
    where: {
      id,
      published: true
    },
    select: {
      id: true,
      name: true,
      description: true,
      coverImageUrl: true,
      category: true,
      createdAt: true,
      media: {
        select: {
          id: true,
          url: true,
          caption: true,
          order: true
        },
        orderBy: { order: "asc" }
      },
      _count: {
        select: { media: true }
      }
    }
  });

  if (!album) return null;

  return {
    id: album.id,
    name: album.name,
    description: album.description,
    coverImageUrl: album.coverImageUrl || album.media[0]?.url || null,
    category: album.category,
    createdAt: album.createdAt,
    photoCount: album._count.media,
    samplePhotos: album.media.slice(0, 4),
    photos: album.media
  };
}
