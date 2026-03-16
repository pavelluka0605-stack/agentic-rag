<?php
/**
 * RankMath Pro — Programmatic Configuration
 *
 * Configures title/description templates, sitemap, breadcrumbs,
 * Open Graph defaults, and Local SEO via RankMath hooks.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Only run when RankMath is active.
if ( ! function_exists( 'rank_math' ) ) {
	return;
}

// =============================================================================
// 1. Meta Title / Description Templates
// =============================================================================

add_filter( 'rank_math/settings/general', 'kuhni_rema_rm_title_templates' );

/**
 * Override RankMath title/description templates for each page type.
 *
 * @param array $settings RankMath general settings.
 * @return array
 */
function kuhni_rema_rm_title_templates( $settings ) {

	// --- Homepage ---
	$settings['homepage_title']       = 'Кухни на заказ в Красноярске от производителя | Кухни Рема';
	$settings['homepage_description'] = 'Кухни на заказ от производителя в Красноярске. Бесплатный замер, 3D-проект, рассрочка 0%. Производство кухонь Кухни Рема.';

	// --- Single kitchen (CPT) ---
	$settings['pt_kitchen_title']       = '%title% | Кухни Рема — от %custom_field(kitchen_price)% ₽';
	$settings['pt_kitchen_description'] = '%excerpt% — Кухня на заказ в Красноярске от производителя. Бесплатный замер и 3D-проект.';

	// --- Kitchen archive ---
	$settings['pt_kitchen_archive_title']       = 'Каталог кухонь на заказ | Кухни Рема';
	$settings['pt_kitchen_archive_description'] = 'Каталог кухонь на заказ в Красноярске. Более 200 моделей от производителя. Цены, фото, характеристики.';

	// --- Project CPT ---
	$settings['pt_project_title']       = '%title% | Портфолио Кухни Рема';
	$settings['pt_project_description'] = '%excerpt% — Реализованный проект кухни от Кухни Рема в Красноярске.';

	return $settings;
}

// --- Taxonomy: kitchen_type ---
add_filter( 'rank_math/settings/titles', 'kuhni_rema_rm_taxonomy_templates' );

/**
 * Override RankMath taxonomy title/description templates.
 *
 * @param array $settings RankMath titles settings.
 * @return array
 */
function kuhni_rema_rm_taxonomy_templates( $settings ) {

	// kitchen_type
	$settings['tax_kitchen_type_title']       = '%term% кухни на заказ в Красноярске | Кухни Рема';
	$settings['tax_kitchen_type_description'] = '%term_description% — каталог %term% кухонь на заказ от производителя в Красноярске.';

	// kitchen_style
	$settings['tax_kitchen_style_title']       = 'Кухни в стиле %term% на заказ | Кухни Рема';
	$settings['tax_kitchen_style_description'] = 'Кухни в стиле %term% на заказ в Красноярске. Каталог с ценами и фото от производителя.';

	// kitchen_material
	$settings['tax_kitchen_material_title']       = 'Кухни из %term% на заказ | Кухни Рема';
	$settings['tax_kitchen_material_description'] = 'Кухни из %term% на заказ в Красноярске от производителя. Цены, фото, характеристики.';

	return $settings;
}

// --- Static pages (About, Contacts, FAQ, Reviews, Portfolio) ---
add_filter( 'rank_math/frontend/title', 'kuhni_rema_rm_page_titles' );

/**
 * Override titles for specific static pages.
 *
 * @param string $title Current title.
 * @return string
 */
function kuhni_rema_rm_page_titles( $title ) {

	if ( ! is_page() ) {
		return $title;
	}

	$page_templates = array(
		'templates/page-about.php'     => 'О компании Кухни Рема — производство кухонь в Красноярске',
		'templates/page-contacts.php'  => 'Контакты Кухни Рема — Красноярск | Замер бесплатно',
		'templates/page-faq.php'       => 'Частые вопросы о кухнях на заказ | Кухни Рема',
		'templates/page-reviews.php'   => 'Отзывы о Кухни Рема — Красноярск | Рейтинг 4.8',
		'templates/page-portfolio.php' => 'Портфолио кухонь | Кухни Рема — Красноярск',
	);

	$current_template = get_page_template_slug();

	if ( $current_template && isset( $page_templates[ $current_template ] ) ) {
		return $page_templates[ $current_template ];
	}

	// Fallback: match by page slug.
	$slug_titles = array(
		'o-kompanii' => 'О компании Кухни Рема — производство кухонь в Красноярске',
		'about'      => 'О компании Кухни Рема — производство кухонь в Красноярске',
		'kontakty'   => 'Контакты Кухни Рема — Красноярск | Замер бесплатно',
		'contacts'   => 'Контакты Кухни Рема — Красноярск | Замер бесплатно',
		'faq'        => 'Частые вопросы о кухнях на заказ | Кухни Рема',
		'otzyvy'     => 'Отзывы о Кухни Рема — Красноярск | Рейтинг 4.8',
		'reviews'    => 'Отзывы о Кухни Рема — Красноярск | Рейтинг 4.8',
		'portfolio'  => 'Портфолио кухонь | Кухни Рема — Красноярск',
	);

	$page_slug = get_post_field( 'post_name', get_queried_object_id() );

	if ( isset( $slug_titles[ $page_slug ] ) ) {
		return $slug_titles[ $page_slug ];
	}

	return $title;
}

// --- Static page descriptions ---
add_filter( 'rank_math/frontend/description', 'kuhni_rema_rm_page_descriptions' );

/**
 * Override meta descriptions for specific static pages.
 *
 * @param string $description Current description.
 * @return string
 */
function kuhni_rema_rm_page_descriptions( $description ) {

	if ( ! is_page() ) {
		return $description;
	}

	$slug_descriptions = array(
		'o-kompanii' => 'Кухни Рема — производство кухонь на заказ в Красноярске. Собственное производство, гарантия 5 лет, бесплатный замер.',
		'about'      => 'Кухни Рема — производство кухонь на заказ в Красноярске. Собственное производство, гарантия 5 лет, бесплатный замер.',
		'kontakty'   => 'Адрес, телефон и режим работы Кухни Рема в Красноярске. Бесплатный замер на дому. Звоните!',
		'contacts'   => 'Адрес, телефон и режим работы Кухни Рема в Красноярске. Бесплатный замер на дому. Звоните!',
		'faq'        => 'Ответы на частые вопросы о кухнях на заказ: сроки, материалы, доставка, установка, гарантия. Кухни Рема — Красноярск.',
		'otzyvy'     => 'Реальные отзывы клиентов о кухнях на заказ от Кухни Рема. Средний рейтинг 4.8 из 5. Красноярск.',
		'reviews'    => 'Реальные отзывы клиентов о кухнях на заказ от Кухни Рема. Средний рейтинг 4.8 из 5. Красноярск.',
		'portfolio'  => 'Фото реализованных проектов кухонь от Кухни Рема в Красноярске. Более 200 выполненных работ.',
	);

	$page_slug = get_post_field( 'post_name', get_queried_object_id() );

	if ( isset( $slug_descriptions[ $page_slug ] ) ) {
		return $slug_descriptions[ $page_slug ];
	}

	return $description;
}

// =============================================================================
// 2. Sitemap Settings
// =============================================================================

/**
 * Include specific CPTs in sitemap.
 */
add_filter( 'rank_math/sitemap/exclude_post_type', 'kuhni_rema_rm_sitemap_cpts', 10, 2 );

function kuhni_rema_rm_sitemap_cpts( $exclude, $post_type ) {

	// Explicitly include these CPTs.
	$include = array( 'kitchen', 'project' );
	if ( in_array( $post_type, $include, true ) ) {
		return false;
	}

	// Explicitly exclude these CPTs.
	$exclude_types = array( 'review', 'team', 'promotion', 'faq' );
	if ( in_array( $post_type, $exclude_types, true ) ) {
		return true;
	}

	return $exclude;
}

/**
 * Include specific taxonomies in sitemap.
 */
add_filter( 'rank_math/sitemap/exclude_taxonomy', 'kuhni_rema_rm_sitemap_taxonomies', 10, 2 );

function kuhni_rema_rm_sitemap_taxonomies( $exclude, $taxonomy ) {

	$include = array( 'kitchen_type', 'kitchen_style', 'kitchen_material' );
	if ( in_array( $taxonomy, $include, true ) ) {
		return false;
	}

	return $exclude;
}

// =============================================================================
// 3. Breadcrumbs — Disable RankMath breadcrumbs (theme has custom ones)
// =============================================================================

add_filter( 'rank_math/frontend/breadcrumb/html', '__return_empty_string' );

// Also disable via module filter (prevents breadcrumb module from loading).
add_filter( 'rank_math/modules', 'kuhni_rema_rm_disable_breadcrumbs_module' );

function kuhni_rema_rm_disable_breadcrumbs_module( $modules ) {
	unset( $modules['breadcrumbs'] );
	return $modules;
}

// =============================================================================
// 4. Open Graph Defaults
// =============================================================================

add_filter( 'rank_math/opengraph/facebook', 'kuhni_rema_rm_og_defaults' );

/**
 * Set Open Graph defaults.
 *
 * @param \RankMath\OpenGraph\Facebook $og OG instance.
 * @return \RankMath\OpenGraph\Facebook
 */
function kuhni_rema_rm_og_defaults( $og ) {
	return $og;
}

// Force og:locale to ru_RU.
add_filter( 'rank_math/opengraph/facebook/og_locale', function () {
	return 'ru_RU';
});

// Default OG image from ACF options.
add_filter( 'rank_math/opengraph/facebook/og_image', 'kuhni_rema_rm_default_og_image' );
add_filter( 'rank_math/opengraph/twitter/image', 'kuhni_rema_rm_default_og_image' );

function kuhni_rema_rm_default_og_image( $image ) {
	if ( ! empty( $image ) ) {
		return $image;
	}

	// Try ACF options page.
	if ( function_exists( 'get_field' ) ) {
		$default_image = get_field( 'og_default_image', 'option' );
		if ( $default_image ) {
			if ( is_array( $default_image ) && ! empty( $default_image['url'] ) ) {
				return $default_image['url'];
			}
			if ( is_string( $default_image ) ) {
				return $default_image;
			}
		}
	}

	// Fallback: site logo.
	$custom_logo_id = get_theme_mod( 'custom_logo' );
	if ( $custom_logo_id ) {
		return wp_get_attachment_image_url( $custom_logo_id, 'full' );
	}

	return $image;
}

// =============================================================================
// 5. Local SEO — Organization Snippet
// =============================================================================

add_filter( 'rank_math/json_ld', 'kuhni_rema_rm_local_seo', 99, 2 );

/**
 * Enhance RankMath's Organization/LocalBusiness schema with ACF data.
 *
 * @param array $data JSON-LD data.
 * @param \RankMath\JsonLd $jsonld JsonLd instance.
 * @return array
 */
function kuhni_rema_rm_local_seo( $data, $jsonld ) {

	// Find Organization or LocalBusiness entry.
	foreach ( $data as $key => &$schema ) {
		if ( ! isset( $schema['@type'] ) ) {
			continue;
		}

		$types = (array) $schema['@type'];
		$is_org = array_intersect( $types, array( 'Organization', 'LocalBusiness', 'FurnitureStore' ) );

		if ( empty( $is_org ) ) {
			continue;
		}

		// Override name.
		$schema['name'] = 'Кухни Рема';

		// Phone from ACF options.
		if ( function_exists( 'get_field' ) ) {
			$phone = get_field( 'contacts_phone', 'option' );
			if ( $phone ) {
				$schema['telephone'] = $phone;
			}
		}

		// Fallback phone.
		if ( empty( $schema['telephone'] ) ) {
			$schema['telephone'] = '+7 (391) 216-97-59';
		}

		// Address.
		$schema['address'] = array(
			'@type'           => 'PostalAddress',
			'addressLocality' => 'Красноярск',
			'addressRegion'   => 'Красноярский край',
			'addressCountry'  => 'RU',
			'postalCode'      => '660020',
		);

		// Street address from ACF.
		if ( function_exists( 'get_field' ) ) {
			$address = get_field( 'global_address', 'option' );
			if ( $address ) {
				$schema['address']['streetAddress'] = $address;
			}
		}

		// URL.
		$schema['url'] = home_url( '/' );

		break;
	}

	return $data;
}

// =============================================================================
// 6. Misc RankMath Tweaks
// =============================================================================

// Remove RankMath credits from HTML source.
add_filter( 'rank_math/frontend/remove_credit_notice', '__return_true' );

// Set focus keyword max length.
add_filter( 'rank_math/focus_keyword/maxtags', function () {
	return 5;
});

// Disable RankMath admin bar menu on frontend for non-admins.
add_filter( 'rank_math/admin_bar/items', function ( $items ) {
	if ( ! current_user_can( 'manage_options' ) ) {
		return array();
	}
	return $items;
});
