import * as migration_20260708_124017 from './20260708_124017';
import * as migration_20260708_145516 from './20260708_145516';
import * as migration_20260708_180128 from './20260708_180128';
import * as migration_20260709_083624 from './20260709_083624';
import * as migration_20260709_112710 from './20260709_112710';
import * as migration_20260709_120418 from './20260709_120418';
import * as migration_20260709_122434 from './20260709_122434';
import * as migration_20260710_081510 from './20260710_081510';
import * as migration_20260710_111854 from './20260710_111854';
import * as migration_20260710_115845 from './20260710_115845';
import * as migration_20260710_153109 from './20260710_153109';
import * as migration_20260713_063233 from './20260713_063233';
import * as migration_20260713_111430 from './20260713_111430';
import * as migration_20260716_093732_add_pub_min_tier from './20260716_093732_add_pub_min_tier';
import * as migration_20260717_080538_tiers_perks from './20260717_080538_tiers_perks';
import * as migration_20260717_091412_related_videos from './20260717_091412_related_videos';
import * as migration_20260717_121624_add_video_folders from './20260717_121624_add_video_folders';
import * as migration_20260717_155634_add_gallery from './20260717_155634_add_gallery';
import * as migration_20260718_115114_add_video_provider from './20260718_115114_add_video_provider';
import * as migration_20260719_063944_add_menu_items from './20260719_063944_add_menu_items';
import * as migration_20260719_145511_home_sections from './20260719_145511_home_sections';
import * as migration_20260719_213548_hero_texts from './20260719_213548_hero_texts';
import * as migration_20260719_215914_banner_texts from './20260719_215914_banner_texts';
import * as migration_20260721_070045_add_comments_reactions from './20260721_070045_add_comments_reactions';
import * as migration_20260721_102335_add_publication_isnews from './20260721_102335_add_publication_isnews';
import * as migration_20260721_105030_add_publication_isnews from './20260721_105030_add_publication_isnews';
import * as migration_20260721_113916_add_gallery_image_sizes from './20260721_113916_add_gallery_image_sizes';
import * as migration_20260721_124326_add_category_poster_layout from './20260721_124326_add_category_poster_layout';
import * as migration_20260721_153100_add_media_image_sizes from './20260721_153100_add_media_image_sizes';
import * as migration_20260721_165038_add_poster_rows_section from './20260721_165038_add_poster_rows_section';
import * as migration_20260723_090000_add_author_onboarding from './20260723_090000_add_author_onboarding';
import * as migration_20260724_171950_add_subscriber_email_verify from './20260724_171950_add_subscriber_email_verify';
import * as migration_20260724_172822_add_digest_notifications from './20260724_172822_add_digest_notifications';
import * as migration_20260726_120000_add_search_section from './20260726_120000_add_search_section';
import * as migration_20260726_130000_add_theme_preset from './20260726_130000_add_theme_preset';
import * as migration_20260726_140000_add_subscriber_profile from './20260726_140000_add_subscriber_profile';
import * as migration_20260726_150000_add_activity_events from './20260726_150000_add_activity_events';
import * as migration_20260726_160000_add_submissions_ugc from './20260726_160000_add_submissions_ugc';
import * as migration_20260726_170000_add_social_phase5 from './20260726_170000_add_social_phase5';
import * as migration_20260727_090000_bts_custom_domain from './20260727_090000_bts_custom_domain';
import * as migration_20260729_100000_add_video_series from './20260729_100000_add_video_series';
import * as migration_20260730_120000_add_video_embed from './20260730_120000_add_video_embed';
import * as migration_20260730_140000_add_publication_watch_category from './20260730_140000_add_publication_watch_category';
import * as migration_20260730_191608_add_tags from './20260730_191608_add_tags';
import * as migration_20260731_120000_add_bug_reports from './20260731_120000_add_bug_reports';
import * as migration_20260801_000000_add_multi_category_and_new_flag from './20260801_000000_add_multi_category_and_new_flag';
import * as migration_20260802_120000_add_perk_excluded from './20260802_120000_add_perk_excluded';
import * as migration_20260802_140000_add_video_audio from './20260802_140000_add_video_audio';
import * as migration_20260805_120000_add_downloads from './20260805_120000_add_downloads';
import * as migration_20260805_130000_add_books_chapters from './20260805_130000_add_books_chapters';
import * as migration_20260805_140000_add_book_type_cycle from './20260805_140000_add_book_type_cycle';
import * as migration_20260805_150000_add_book_library_progress from './20260805_150000_add_book_library_progress';
import * as migration_20260805_160000_add_chapter_comments from './20260805_160000_add_chapter_comments';
import * as migration_20260805_170000_add_book_genres_quotes from './20260805_170000_add_book_genres_quotes';
import * as migration_20260805_180000_add_book_follows from './20260805_180000_add_book_follows';
import * as migration_20260805_190000_add_studio_entitlements from './20260805_190000_add_studio_entitlements';
import * as migration_20260805_200000_add_booktrailer_video from './20260805_200000_add_booktrailer_video';

export const migrations = [
  {
    up: migration_20260708_124017.up,
    down: migration_20260708_124017.down,
    name: '20260708_124017',
  },
  {
    up: migration_20260708_145516.up,
    down: migration_20260708_145516.down,
    name: '20260708_145516',
  },
  {
    up: migration_20260708_180128.up,
    down: migration_20260708_180128.down,
    name: '20260708_180128',
  },
  {
    up: migration_20260709_083624.up,
    down: migration_20260709_083624.down,
    name: '20260709_083624',
  },
  {
    up: migration_20260709_112710.up,
    down: migration_20260709_112710.down,
    name: '20260709_112710',
  },
  {
    up: migration_20260709_120418.up,
    down: migration_20260709_120418.down,
    name: '20260709_120418',
  },
  {
    up: migration_20260709_122434.up,
    down: migration_20260709_122434.down,
    name: '20260709_122434',
  },
  {
    up: migration_20260710_081510.up,
    down: migration_20260710_081510.down,
    name: '20260710_081510',
  },
  {
    up: migration_20260710_111854.up,
    down: migration_20260710_111854.down,
    name: '20260710_111854',
  },
  {
    up: migration_20260710_115845.up,
    down: migration_20260710_115845.down,
    name: '20260710_115845',
  },
  {
    up: migration_20260710_153109.up,
    down: migration_20260710_153109.down,
    name: '20260710_153109',
  },
  {
    up: migration_20260713_063233.up,
    down: migration_20260713_063233.down,
    name: '20260713_063233',
  },
  {
    up: migration_20260713_111430.up,
    down: migration_20260713_111430.down,
    name: '20260713_111430',
  },
  {
    up: migration_20260716_093732_add_pub_min_tier.up,
    down: migration_20260716_093732_add_pub_min_tier.down,
    name: '20260716_093732_add_pub_min_tier',
  },
  {
    up: migration_20260717_080538_tiers_perks.up,
    down: migration_20260717_080538_tiers_perks.down,
    name: '20260717_080538_tiers_perks',
  },
  {
    up: migration_20260717_091412_related_videos.up,
    down: migration_20260717_091412_related_videos.down,
    name: '20260717_091412_related_videos',
  },
  {
    up: migration_20260717_121624_add_video_folders.up,
    down: migration_20260717_121624_add_video_folders.down,
    name: '20260717_121624_add_video_folders',
  },
  {
    up: migration_20260717_155634_add_gallery.up,
    down: migration_20260717_155634_add_gallery.down,
    name: '20260717_155634_add_gallery',
  },
  {
    up: migration_20260718_115114_add_video_provider.up,
    down: migration_20260718_115114_add_video_provider.down,
    name: '20260718_115114_add_video_provider',
  },
  {
    up: migration_20260719_063944_add_menu_items.up,
    down: migration_20260719_063944_add_menu_items.down,
    name: '20260719_063944_add_menu_items',
  },
  {
    up: migration_20260719_145511_home_sections.up,
    down: migration_20260719_145511_home_sections.down,
    name: '20260719_145511_home_sections',
  },
  {
    up: migration_20260719_213548_hero_texts.up,
    down: migration_20260719_213548_hero_texts.down,
    name: '20260719_213548_hero_texts',
  },
  {
    up: migration_20260719_215914_banner_texts.up,
    down: migration_20260719_215914_banner_texts.down,
    name: '20260719_215914_banner_texts',
  },
  {
    up: migration_20260721_070045_add_comments_reactions.up,
    down: migration_20260721_070045_add_comments_reactions.down,
    name: '20260721_070045_add_comments_reactions',
  },
  {
    up: migration_20260721_102335_add_publication_isnews.up,
    down: migration_20260721_102335_add_publication_isnews.down,
    name: '20260721_102335_add_publication_isnews',
  },
  {
    up: migration_20260721_105030_add_publication_isnews.up,
    down: migration_20260721_105030_add_publication_isnews.down,
    name: '20260721_105030_add_publication_isnews',
  },
  {
    up: migration_20260721_113916_add_gallery_image_sizes.up,
    down: migration_20260721_113916_add_gallery_image_sizes.down,
    name: '20260721_113916_add_gallery_image_sizes',
  },
  {
    up: migration_20260721_124326_add_category_poster_layout.up,
    down: migration_20260721_124326_add_category_poster_layout.down,
    name: '20260721_124326_add_category_poster_layout',
  },
  {
    up: migration_20260721_153100_add_media_image_sizes.up,
    down: migration_20260721_153100_add_media_image_sizes.down,
    name: '20260721_153100_add_media_image_sizes',
  },
  {
    up: migration_20260721_165038_add_poster_rows_section.up,
    down: migration_20260721_165038_add_poster_rows_section.down,
    name: '20260721_165038_add_poster_rows_section',
  },
  {
    up: migration_20260723_090000_add_author_onboarding.up,
    down: migration_20260723_090000_add_author_onboarding.down,
    name: '20260723_090000_add_author_onboarding',
  },
  {
    up: migration_20260724_171950_add_subscriber_email_verify.up,
    down: migration_20260724_171950_add_subscriber_email_verify.down,
    name: '20260724_171950_add_subscriber_email_verify',
  },
  {
    up: migration_20260724_172822_add_digest_notifications.up,
    down: migration_20260724_172822_add_digest_notifications.down,
    name: '20260724_172822_add_digest_notifications',
  },
  {
    up: migration_20260726_120000_add_search_section.up,
    down: migration_20260726_120000_add_search_section.down,
    name: '20260726_120000_add_search_section',
  },
  {
    up: migration_20260726_130000_add_theme_preset.up,
    down: migration_20260726_130000_add_theme_preset.down,
    name: '20260726_130000_add_theme_preset',
  },
  {
    up: migration_20260726_140000_add_subscriber_profile.up,
    down: migration_20260726_140000_add_subscriber_profile.down,
    name: '20260726_140000_add_subscriber_profile',
  },
  {
    up: migration_20260726_150000_add_activity_events.up,
    down: migration_20260726_150000_add_activity_events.down,
    name: '20260726_150000_add_activity_events',
  },
  {
    up: migration_20260726_160000_add_submissions_ugc.up,
    down: migration_20260726_160000_add_submissions_ugc.down,
    name: '20260726_160000_add_submissions_ugc',
  },
  {
    up: migration_20260726_170000_add_social_phase5.up,
    down: migration_20260726_170000_add_social_phase5.down,
    name: '20260726_170000_add_social_phase5',
  },
  {
    up: migration_20260727_090000_bts_custom_domain.up,
    down: migration_20260727_090000_bts_custom_domain.down,
    name: '20260727_090000_bts_custom_domain',
  },
  {
    up: migration_20260729_100000_add_video_series.up,
    down: migration_20260729_100000_add_video_series.down,
    name: '20260729_100000_add_video_series',
  },
  {
    up: migration_20260730_120000_add_video_embed.up,
    down: migration_20260730_120000_add_video_embed.down,
    name: '20260730_120000_add_video_embed',
  },
  {
    up: migration_20260730_140000_add_publication_watch_category.up,
    down: migration_20260730_140000_add_publication_watch_category.down,
    name: '20260730_140000_add_publication_watch_category',
  },
  {
    up: migration_20260730_191608_add_tags.up,
    down: migration_20260730_191608_add_tags.down,
    name: '20260730_191608_add_tags'
  },
  {
    up: migration_20260731_120000_add_bug_reports.up,
    down: migration_20260731_120000_add_bug_reports.down,
    name: '20260731_120000_add_bug_reports',
  },
  {
    up: migration_20260801_000000_add_multi_category_and_new_flag.up,
    down: migration_20260801_000000_add_multi_category_and_new_flag.down,
    name: '20260801_000000_add_multi_category_and_new_flag',
  },
  {
    up: migration_20260802_120000_add_perk_excluded.up,
    down: migration_20260802_120000_add_perk_excluded.down,
    name: '20260802_120000_add_perk_excluded',
  },
  {
    up: migration_20260802_140000_add_video_audio.up,
    down: migration_20260802_140000_add_video_audio.down,
    name: '20260802_140000_add_video_audio',
  },
  {
    up: migration_20260805_120000_add_downloads.up,
    down: migration_20260805_120000_add_downloads.down,
    name: '20260805_120000_add_downloads',
  },
  {
    up: migration_20260805_130000_add_books_chapters.up,
    down: migration_20260805_130000_add_books_chapters.down,
    name: '20260805_130000_add_books_chapters',
  },
  {
    up: migration_20260805_140000_add_book_type_cycle.up,
    down: migration_20260805_140000_add_book_type_cycle.down,
    name: '20260805_140000_add_book_type_cycle',
  },
  {
    up: migration_20260805_150000_add_book_library_progress.up,
    down: migration_20260805_150000_add_book_library_progress.down,
    name: '20260805_150000_add_book_library_progress',
  },
  {
    up: migration_20260805_160000_add_chapter_comments.up,
    down: migration_20260805_160000_add_chapter_comments.down,
    name: '20260805_160000_add_chapter_comments',
  },
  {
    up: migration_20260805_170000_add_book_genres_quotes.up,
    down: migration_20260805_170000_add_book_genres_quotes.down,
    name: '20260805_170000_add_book_genres_quotes',
  },
  {
    up: migration_20260805_180000_add_book_follows.up,
    down: migration_20260805_180000_add_book_follows.down,
    name: '20260805_180000_add_book_follows',
  },
  {
    up: migration_20260805_190000_add_studio_entitlements.up,
    down: migration_20260805_190000_add_studio_entitlements.down,
    name: '20260805_190000_add_studio_entitlements',
  },
  {
    up: migration_20260805_200000_add_booktrailer_video.up,
    down: migration_20260805_200000_add_booktrailer_video.down,
    name: '20260805_200000_add_booktrailer_video',
  },
];
