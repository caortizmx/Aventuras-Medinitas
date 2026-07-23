export const SCENE_ATLAS_SMOKE = 'AtlasSmoke';
export const SCENE_ASSET_GALLERY = 'AssetGallery';

export function getDevelopmentAssetScene(pathname: string): string | undefined {
    if (!import.meta.env.DEV) return undefined;
    if (pathname.endsWith('/atlas-smoke')) return SCENE_ATLAS_SMOKE;
    if (pathname.endsWith('/asset-gallery')) return SCENE_ASSET_GALLERY;
    return undefined;
}
