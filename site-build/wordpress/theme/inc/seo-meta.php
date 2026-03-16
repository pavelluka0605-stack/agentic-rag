<?php
/**
 * SEO meta tags and performance hints for "Кухни Рема"
 *
 * Open Graph, preconnect/dns-prefetch, viewport, Yandex verification.
 * OG tags are suppressed when RankMath is active to avoid duplicates.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_head', 'kuhni_rema_meta_output', 1 );

/**
 * Main meta output dispatcher.
 */
function kuhni_rema_meta_output() {

	kuhni_rema_meta_viewport();
	kuhni_rema_meta_format_detection();
	kuhni_rema_meta_theme_color();
	kuhni_rema_meta_preconnect();
	kuhni_rema_meta_yandex_verification();
	kuhni_rema_meta_google_verification();
	kuhni_rema_meta_canonical();
	kuhni_rema_meta_og();
	kuhni_rema_meta_twitter();
}

/* ---------------------------------------------------------------
 * Viewport (only if not already present from theme)
 * ------------------------------------------------------------- */
function kuhni_rema_meta_viewport() {
	/**
	 * Most themes output viewport in header.php.
	 * We check a flag so themes can opt out:
	 *   add_theme_support( 'kuhni-rema-viewport' )
	 * If theme already sets viewport, skip.
	 */
	if ( ! current_theme_supports( 'kuhni-rema-viewport' ) ) {
		return;
	}
	echo '<meta name="viewport" content="width=device-width, initial-scale=1">' . "\n";
}

/* ---------------------------------------------------------------
 * Disable phone auto-detection (Safari)
 * ------------------------------------------------------------- */
function kuhni_rema_meta_format_detection() {
	echo '<meta name="format-detection" content="telephone=no">' . "\n";
}

/* ---------------------------------------------------------------
 * Preconnect hints
 * ------------------------------------------------------------- */
function kuhni_rema_meta_preconnect() {
	$origins = array(
		'https://fonts.googleapis.com',
		'https://fonts.gstatic.com',
		'https://mc.yandex.ru',
	);

	foreach ( $origins as $origin ) {
		$crossorigin = ( false !== strpos( $origin, 'fonts.gstatic.com' ) ) ? ' crossorigin' : '';
		echo '<link rel="preconnect" href="' . esc_url( $origin ) . '"' . $crossorigin . '>' . "\n";
	}
}


/* ---------------------------------------------------------------
 * Yandex verification meta tag
 * ------------------------------------------------------------- */
function kuhni_rema_meta_yandex_verification() {

	$code = '';

	// Try ACF option first.
	if ( function_exists( 'get_field' ) ) {
		$code = get_field( 'yandex_verification', 'option' );
	}

	// Fallback to wp_options.
	if ( ! $code ) {
		$code = get_option( 'kuhni_rema_yandex_verification', '' );
	}

	if ( $code ) {
		echo '<meta name="yandex-verification" content="' . esc_attr( $code ) . '">' . "\n";
	}
}

/* ---------------------------------------------------------------
 * Canonical URL — skip if RankMath handles it
 * ------------------------------------------------------------- */
function kuhni_rema_meta_canonical() {

	// RankMath or Yoast already output canonical.
	if ( function_exists( 'rank_math' ) || defined( 'WPSEO_VERSION' ) ) {
		return;
	}

	$canonical = '';

	if ( is_singular() ) {
		$canonical = get_permalink();
	} elseif ( is_home() || is_front_page() ) {
		$canonical = home_url( '/' );
	} elseif ( is_category() || is_tag() || is_tax() ) {
		$term = get_queried_object();
		if ( $term && ! is_wp_error( $term ) ) {
			$canonical = get_term_link( $term );
		}
	} elseif ( is_post_type_archive() ) {
		$canonical = get_post_type_archive_link( get_post_type() );
	}

	if ( $canonical && ! is_wp_error( $canonical ) ) {
		echo '<link rel="canonical" href="' . esc_url( $canonical ) . '">' . "\n";
	}
}

/* ---------------------------------------------------------------
 * Open Graph tags — only when RankMath is NOT active
 * ------------------------------------------------------------- */
function kuhni_rema_meta_og() {

	// Skip if RankMath or Yoast handle OG.
	if ( function_exists( 'rank_math' ) || defined( 'WPSEO_VERSION' ) ) {
		return;
	}

	$og = array(
		'og:locale' => 'ru_RU',
		'og:type'   => 'website',
		'og:url'    => '',
		'og:title'  => '',
		'og:description' => '',
		'og:image'  => '',
		'og:site_name'   => 'Кухни Рема',
	);

	// URL.
	if ( is_singular() ) {
		$og['og:url'] = get_permalink();
	} else {
		$og['og:url'] = home_url( parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ) );
	}

	// Title.
	$og['og:title'] = wp_get_document_title();

	// Description.
	if ( is_singular() ) {
		$og['og:type'] = ( 'kitchen' === get_post_type() ) ? 'product' : 'article';

		$excerpt = get_the_excerpt();
		if ( $excerpt ) {
			$og['og:description'] = wp_trim_words( $excerpt, 30, '...' );
		}
	} else {
		$og['og:description'] = get_bloginfo( 'description' );
	}

	// Image.
	if ( is_singular() && has_post_thumbnail() ) {
		$og['og:image'] = get_the_post_thumbnail_url( get_the_ID(), 'large' );
	} else {
		// Fallback: site logo or ACF option.
		$fallback_image = '';
		if ( function_exists( 'get_field' ) ) {
			$fallback_image = get_field( 'og_default_image', 'option' );
		}
		if ( ! $fallback_image ) {
			$custom_logo_id = get_theme_mod( 'custom_logo' );
			if ( $custom_logo_id ) {
				$fallback_image = wp_get_attachment_image_url( $custom_logo_id, 'full' );
			}
		}
		$og['og:image'] = $fallback_image;
	}

	// Output.
	foreach ( $og as $property => $content ) {
		if ( $content ) {
			echo '<meta property="' . esc_attr( $property ) . '" content="' . esc_attr( $content ) . '">' . "\n";
			// Add image dimensions after og:image.
			if ( 'og:image' === $property ) {
				echo '<meta property="og:image:width" content="1200">' . "\n";
				echo '<meta property="og:image:height" content="630">' . "\n";
			}
		}
	}
}

/* ---------------------------------------------------------------
 * Twitter Card meta tags — only when RankMath/Yoast is NOT active
 * ------------------------------------------------------------- */
function kuhni_rema_meta_twitter() {

	// Skip if RankMath or Yoast handle Twitter cards.
	if ( function_exists( 'rank_math' ) || defined( 'WPSEO_VERSION' ) ) {
		return;
	}

	$title       = wp_get_document_title();
	$description = '';
	$image       = '';

	if ( is_singular() ) {
		$excerpt = get_the_excerpt();
		if ( $excerpt ) {
			$description = wp_trim_words( $excerpt, 30, '...' );
		}
		if ( has_post_thumbnail() ) {
			$image = get_the_post_thumbnail_url( get_the_ID(), 'large' );
		}
	} else {
		$description = get_bloginfo( 'description' );
	}

	// Fallback image.
	if ( ! $image ) {
		$fallback_image = '';
		if ( function_exists( 'get_field' ) ) {
			$fallback_image = get_field( 'og_default_image', 'option' );
		}
		if ( ! $fallback_image ) {
			$custom_logo_id = get_theme_mod( 'custom_logo' );
			if ( $custom_logo_id ) {
				$fallback_image = wp_get_attachment_image_url( $custom_logo_id, 'full' );
			}
		}
		$image = $fallback_image;
	}

	echo '<meta name="twitter:card" content="summary_large_image">' . "\n";

	if ( $title ) {
		echo '<meta name="twitter:title" content="' . esc_attr( $title ) . '">' . "\n";
	}
	if ( $description ) {
		echo '<meta name="twitter:description" content="' . esc_attr( $description ) . '">' . "\n";
	}
	if ( $image ) {
		echo '<meta name="twitter:image" content="' . esc_attr( $image ) . '">' . "\n";
	}
}

/* ---------------------------------------------------------------
 * Theme color
 * ------------------------------------------------------------- */
function kuhni_rema_meta_theme_color() {
	echo '<meta name="theme-color" content="#1a1a1a">' . "\n";
}

/* ---------------------------------------------------------------
 * Google Site Verification
 * ------------------------------------------------------------- */
function kuhni_rema_meta_google_verification() {

	$code = '';

	if ( function_exists( 'get_field' ) ) {
		$code = get_field( 'google_verification', 'option' );
	}

	if ( $code ) {
		echo '<meta name="google-site-verification" content="' . esc_attr( $code ) . '">' . "\n";
	}
}
