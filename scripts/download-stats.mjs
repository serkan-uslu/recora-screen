// ponytail: report the latest 100 releases; paginate if the release history grows beyond that.
const response = await fetch(
  "https://api.github.com/repos/serkan-uslu/screen-recorder/releases?per_page=100",
  {
    headers: { Accept: "application/vnd.github+json" },
  },
);
if (!response.ok) throw new Error(`GitHub release statistics unavailable: HTTP ${response.status}`);
const releases = await response.json();
const assets = releases.flatMap((release) =>
  release.assets
    .filter((asset) => /\.(dmg|zip)$/.test(asset.name))
    .map((asset) => ({
      release: release.tag_name,
      asset: asset.name,
      downloads: asset.download_count,
    })),
);
console.table(assets);
console.log(
  `GitHub asset downloads: ${assets.reduce((total, asset) => total + asset.downloads, 0)}. These are distribution counts, not installs or website clicks.`,
);
