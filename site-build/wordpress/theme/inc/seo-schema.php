<?php
/**
 * Schema.org structured data (JSON-LD) for "Кухни Рема"
 *
 * Outputs structured data via wp_head hook.
 * Schema types: Organization, LocalBusiness, Product, FAQPage, AggregateRating.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_head', 'kuhni_rema_schema_output', 1 );

/**
 * Main schema output dispatcher.
 */
function kuhni_rema_schema_output() {

	// Organization — on every page.
	kuhni_rema_schema_organization();

	// LocalBusiness — only on the contacts page.
	if ( is_page( array( 'kontakty', 'contacts' ) ) || kuhni_rema_is_page_template( 'contacts' ) ) {
		kuhni_rema_schema_local_business();
	}

	// Product — single kitchen (CPT "kitchen" or kitchen category).
	if ( is_singular( 'kitchen' ) ) {
		kuhni_rema_schema_product();
	}

	// FAQPage — FAQ page or FAQ archive.
	if ( is_page( array( 'faq', 'voprosy-i-otvety' ) ) || kuhni_rema_is_page_template( 'faq' ) ) {
		kuhni_rema_schema_faq();
	}

	// AggregateRating — reviews page.
	if ( is_page( array( 'otzyvy', 'reviews' ) ) || kuhni_rema_is_page_template( 'reviews' ) ) {
		kuhni_rema_schema_aggregate_rating();
	}
}

/**
 * Helper: check page template by slug fragment.
 *
 * @param string $slug Template slug fragment.
 * @return bool
 */
function kuhni_rema_is_page_template( $slug ) {
	if ( ! is_page() ) {
		return false;
	}
	$template = get_page_template_slug();
	return $template && false !== strpos( $template, $slug );
}

/**
 * Helper: get ACF option field with fallback.
 *
 * @param string $field   ACF field name.
 * @param mixed  $default Default value.
 * @return mixed
 */
function kuhni_rema_get_option( $field, $default = '' ) {
	if ( function_exists( 'get_field' ) ) {
		$value = get_field( $field, 'option' );
		if ( $value ) {
			return $value;
		}
	}
	return $default;
}

/**
 * Output a JSON-LD script block.
 *
 * @param array $data Schema data array.
 */
function kuhni_rema_render_jsonld( $data ) {
	if ( empty( $data ) ) {
		return;
	}
	echo '<script type="application/ld+json">' . "\n";
	echo wp_json_encode( $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );
	echo "\n" . '</script>' . "\n";
}

/* ---------------------------------------------------------------
 * Schema: Organization (all pages)
 * ------------------------------------------------------------- */
function kuhni_rema_schema_organization() {

	$phone    = kuhni_rema_get_option( 'company_phone', '+7 (XXX) XXX-XX-XX' );
	$address  = kuhni_rema_get_option( 'company_address', '' );
	$vk_url   = kuhni_rema_get_option( 'social_vk', '' );
	$tg_url   = kuhni_rema_get_option( 'social_telegram', '' );
	$logo_url = kuhni_rema_get_option( 'company_logo', '' );

	if ( ! $logo_url ) {
		$custom_logo_id = get_theme_mod( 'custom_logo' );
		if ( $custom_logo_id ) {
			$logo_url = wp_get_attachment_image_url( $custom_logo_id, 'full' );
		}
	}

	$same_as = array();
	if ( $vk_url ) {
		$same_as[] = $vk_url;
	}
	if ( $tg_url ) {
		$same_as[] = $tg_url;
	}

	$schema = array(
		'@context' => 'https://schema.org',
		'@type'    => 'Organization',
		'name'     => 'Кухни Рема',
		'url'      => 'https://кухнирема.рф',
		'telephone' => $phone,
	);

	if ( $logo_url ) {
		$schema['logo'] = array(
			'@type'  => 'ImageObject',
			'url'    => $logo_url,
		);
	}

	if ( $address ) {
		$schema['address'] = array(
			'@type'           => 'PostalAddress',
			'streetAddress'   => $address,
			'addressLocality' => kuhni_rema_get_option( 'company_city', 'Москва' ),
			'addressRegion'   => kuhni_rema_get_option( 'company_region', 'Москва' ),
			'postalCode'      => kuhni_rema_get_option( 'company_postal_code', '' ),
			'addressCountry'  => 'RU',
		);
	}

	if ( ! empty( $same_as ) ) {
		$schema['sameAs'] = $same_as;
	}

	kuhni_rema_render_jsonld( $schema );
}

/* ---------------------------------------------------------------
 * Schema: LocalBusiness (contacts page)
 * ------------------------------------------------------------- */
function kuhni_rema_schema_local_business() {

	$phone    = kuhni_rema_get_option( 'company_phone', '+7 (XXX) XXX-XX-XX' );
	$address  = kuhni_rema_get_option( 'company_address', '' );
	$vk_url   = kuhni_rema_get_option( 'social_vk', '' );
	$tg_url   = kuhni_rema_get_option( 'social_telegram', '' );
	$logo_url = kuhni_rema_get_option( 'company_logo', '' );
	$lat      = kuhni_rema_get_option( 'geo_latitude', '' );
	$lng      = kuhni_rema_get_option( 'geo_longitude', '' );
	$hours    = kuhni_rema_get_option( 'opening_hours', '' ); // e.g. "Mo-Fr 09:00-19:00, Sa 10:00-17:00"

	if ( ! $logo_url ) {
		$custom_logo_id = get_theme_mod( 'custom_logo' );
		if ( $custom_logo_id ) {
			$logo_url = wp_get_attachment_image_url( $custom_logo_id, 'full' );
		}
	}

	$same_as = array();
	if ( $vk_url ) {
		$same_as[] = $vk_url;
	}
	if ( $tg_url ) {
		$same_as[] = $tg_url;
	}

	$schema = array(
		'@context'  => 'https://schema.org',
		'@type'     => 'FurnitureStore',
		'name'      => 'Кухни Рема',
		'url'       => 'https://кухнирема.рф',
		'telephone' => $phone,
		'image'     => $logo_url ? $logo_url : '',
	);

	if ( $address ) {
		$schema['address'] = array(
			'@type'           => 'PostalAddress',
			'streetAddress'   => $address,
			'addressLocality' => kuhni_rema_get_option( 'company_city', 'Москва' ),
			'addressRegion'   => kuhni_rema_get_option( 'company_region', 'Москва' ),
			'postalCode'      => kuhni_rema_get_option( 'company_postal_code', '' ),
			'addressCountry'  => 'RU',
		);
	}

	if ( $lat && $lng ) {
		$schema['geo'] = array(
			'@type'     => 'GeoCoordinates',
			'latitude'  => (float) $lat,
			'longitude' => (float) $lng,
		);
	}

	if ( $hours ) {
		// ACF field stores comma-separated specs, e.g. "Mo-Fr 09:00-19:00, Sa 10:00-17:00".
		$specs = array_map( 'trim', explode( ',', $hours ) );
		$schema['openingHours'] = $specs;
	}

	if ( ! empty( $same_as ) ) {
		$schema['sameAs'] = $same_as;
	}

	$schema['priceRange'] = kuhni_rema_get_option( 'price_range', '$$' );

	kuhni_rema_render_jsonld( $schema );
}

/* ---------------------------------------------------------------
 * Schema: Product (single kitchen CPT)
 * ------------------------------------------------------------- */
function kuhni_rema_schema_product() {

	$post_id     = get_the_ID();
	$title       = get_the_title( $post_id );
	$description = get_the_excerpt( $post_id );
	$permalink   = get_permalink( $post_id );
	$image       = get_the_post_thumbnail_url( $post_id, 'large' );

	// ACF fields on the kitchen CPT.
	$price = '';
	if ( function_exists( 'get_field' ) ) {
		$price = get_field( 'kitchen_price', $post_id );
	}

	$schema = array(
		'@context'    => 'https://schema.org',
		'@type'       => 'Product',
		'name'        => $title,
		'description' => $description,
		'url'         => $permalink,
		'brand'       => array(
			'@type' => 'Brand',
			'name'  => 'Кухни Рема',
		),
	);

	if ( $image ) {
		$schema['image'] = $image;
	}

	if ( $price ) {
		$schema['offers'] = array(
			'@type'         => 'Offer',
			'price'         => (float) $price,
			'priceCurrency' => 'RUB',
			'availability'  => 'https://schema.org/InStock',
			'url'           => $permalink,
		);
	}

	kuhni_rema_render_jsonld( $schema );
}

/* ---------------------------------------------------------------
 * Schema: FAQPage
 * ------------------------------------------------------------- */
function kuhni_rema_schema_faq() {

	$faq_posts = get_posts( array(
		'post_type'      => 'faq',
		'posts_per_page' => 100,
		'post_status'    => 'publish',
		'orderby'        => 'menu_order',
		'order'          => 'ASC',
	) );

	if ( empty( $faq_posts ) ) {
		return;
	}

	$entities = array();
	foreach ( $faq_posts as $faq ) {
		$answer = '';
		if ( function_exists( 'get_field' ) ) {
			$answer = get_field( 'faq_answer', $faq->ID );
		}
		if ( ! $answer ) {
			$answer = wp_strip_all_tags( apply_filters( 'the_content', $faq->post_content ) );
		}

		$entities[] = array(
			'@type'          => 'Question',
			'name'           => $faq->post_title,
			'acceptedAnswer' => array(
				'@type' => 'Answer',
				'text'  => $answer,
			),
		);
	}

	$schema = array(
		'@context'   => 'https://schema.org',
		'@type'      => 'FAQPage',
		'mainEntity' => $entities,
	);

	kuhni_rema_render_jsonld( $schema );
}

/* ---------------------------------------------------------------
 * Schema: AggregateRating (reviews page)
 * ------------------------------------------------------------- */
function kuhni_rema_schema_aggregate_rating() {

	$reviews = get_posts( array(
		'post_type'      => 'review',
		'posts_per_page' => -1,
		'post_status'    => 'publish',
	) );

	if ( empty( $reviews ) ) {
		return;
	}

	$total  = count( $reviews );
	$sum    = 0;

	foreach ( $reviews as $review ) {
		$rating = 5; // Default rating.
		if ( function_exists( 'get_field' ) ) {
			$r = get_field( 'review_rating', $review->ID );
			if ( $r ) {
				$rating = (int) $r;
			}
		}
		$sum += $rating;
	}

	$average = round( $sum / $total, 1 );

	$schema = array(
		'@context'        => 'https://schema.org',
		'@type'           => 'FurnitureStore',
		'name'            => 'Кухни Рема',
		'url'             => 'https://кухнирема.рф',
		'aggregateRating' => array(
			'@type'       => 'AggregateRating',
			'ratingValue' => $average,
			'bestRating'  => 5,
			'worstRating' => 1,
			'ratingCount' => $total,
		),
	);

	kuhni_rema_render_jsonld( $schema );
}
