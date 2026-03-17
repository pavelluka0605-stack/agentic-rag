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

	// When RankMath is active, it outputs its own Organization/LocalBusiness schema.
	// Skip theme Organization and LocalBusiness to avoid duplicate entities in Google Search Console.
	if ( ! function_exists( 'rank_math' ) ) {
		// Organization — on every page.
		kuhni_rema_schema_organization();

		// LocalBusiness — only on the contacts page.
		if ( is_page( array( 'kontakty', 'contacts' ) ) || kuhni_rema_is_page_template( 'contacts' ) ) {
			kuhni_rema_schema_local_business();
		}
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

	$phone    = kuhni_rema_option( 'global_phone_main' ) ?: '+7 (391) 216-97-59';
	$address  = kuhni_rema_option( 'global_address' );
	$vk_url   = kuhni_rema_option( 'social_vk_url' );
	$tg_url   = kuhni_rema_option( 'social_tg_url' );

	$logo_url = '';
	$custom_logo_id = get_theme_mod( 'custom_logo' );
	if ( $custom_logo_id ) {
		$logo_url = wp_get_attachment_image_url( $custom_logo_id, 'full' );
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
		'@type'     => 'Organization',
		'@id'       => home_url( '/#organization' ),
		'name'      => 'Кухни Рема',
		'url'       => home_url( '/' ),
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
			'addressLocality' => 'Красноярск',
			'addressRegion'   => 'Красноярский край',
			'postalCode'      => '660020',
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

	$phone    = kuhni_rema_option( 'global_phone_main' ) ?: '+7 (391) 216-97-59';
	$address  = kuhni_rema_option( 'global_address' );
	$vk_url   = kuhni_rema_option( 'social_vk_url' );
	$tg_url   = kuhni_rema_option( 'social_tg_url' );
	$lat      = kuhni_rema_option( 'global_lat' );
	$lng      = kuhni_rema_option( 'global_lng' );
	$hours    = kuhni_rema_option( 'global_working_hours' ); // e.g. "Mo-Fr 09:00-19:00, Sa 10:00-17:00"

	$logo_url = '';
	$custom_logo_id = get_theme_mod( 'custom_logo' );
	if ( $custom_logo_id ) {
		$logo_url = wp_get_attachment_image_url( $custom_logo_id, 'full' );
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
		'@id'       => home_url( '/#organization' ),
		'name'      => 'Кухни Рема',
		'url'       => home_url( '/' ),
		'telephone' => $phone,
	);

	if ( $logo_url ) {
		$schema['image'] = $logo_url;
	}

	if ( $address ) {
		$schema['address'] = array(
			'@type'           => 'PostalAddress',
			'streetAddress'   => $address,
			'addressLocality' => 'Красноярск',
			'addressRegion'   => 'Красноярский край',
			'postalCode'      => '660020',
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
		$opening_hours_spec = array();
		foreach ( $specs as $spec ) {
			$parts = preg_split( '/\s+/', $spec, 2 );
			if ( count( $parts ) === 2 ) {
				$days_part  = $parts[0];
				$time_part  = $parts[1];
				$times      = explode( '-', $time_part );
				$open_time  = isset( $times[0] ) ? $times[0] : '09:00';
				$close_time = isset( $times[1] ) ? $times[1] : '18:00';

				// Expand day range (e.g. "Mo-Fr") or single day (e.g. "Sa").
				$day_map = array(
					'Mo' => 'Monday', 'Tu' => 'Tuesday', 'We' => 'Wednesday',
					'Th' => 'Thursday', 'Fr' => 'Friday', 'Sa' => 'Saturday', 'Su' => 'Sunday',
				);
				$day_keys = array_keys( $day_map );

				if ( false !== strpos( $days_part, '-' ) ) {
					$range     = explode( '-', $days_part );
					$start_idx = array_search( $range[0], $day_keys, true );
					$end_idx   = array_search( $range[1], $day_keys, true );
					if ( false !== $start_idx && false !== $end_idx ) {
						for ( $i = $start_idx; $i <= $end_idx; $i++ ) {
							$opening_hours_spec[] = array(
								'@type'     => 'OpeningHoursSpecification',
								'dayOfWeek' => $day_map[ $day_keys[ $i ] ],
								'opens'     => $open_time,
								'closes'    => $close_time,
							);
						}
					}
				} else {
					if ( isset( $day_map[ $days_part ] ) ) {
						$opening_hours_spec[] = array(
							'@type'     => 'OpeningHoursSpecification',
							'dayOfWeek' => $day_map[ $days_part ],
							'opens'     => $open_time,
							'closes'    => $close_time,
						);
					}
				}
			}
		}
		if ( ! empty( $opening_hours_spec ) ) {
			$schema['openingHoursSpecification'] = $opening_hours_spec;
		}
	}

	if ( ! empty( $same_as ) ) {
		$schema['sameAs'] = $same_as;
	}

	$schema['priceRange'] = '$$';

	kuhni_rema_render_jsonld( $schema );
}

/* ---------------------------------------------------------------
 * Schema: Product (single kitchen CPT)
 * ------------------------------------------------------------- */
function kuhni_rema_schema_product() {

	global $post;

	$post_id     = get_the_ID();
	$title       = get_the_title( $post_id );
	$description = get_the_excerpt( $post_id );
	$permalink   = get_permalink( $post_id );
	$image       = get_the_post_thumbnail_url( $post_id, 'large' );

	// Fallback image: site logo.
	if ( ! $image ) {
		$custom_logo_id = get_theme_mod( 'custom_logo' );
		if ( $custom_logo_id ) {
			$image = wp_get_attachment_image_url( $custom_logo_id, 'full' );
		}
	}

	// ACF fields on the kitchen CPT.
	$price    = '';
	$material = '';
	$category = '';
	if ( function_exists( 'get_field' ) ) {
		$price = get_field( 'kitchen_price', $post_id );
	}
	// Material and type are taxonomies, not ACF fields.
	$material_terms = wp_get_post_terms( $post_id, 'kitchen_material', array( 'fields' => 'names' ) );
	if ( ! is_wp_error( $material_terms ) && ! empty( $material_terms ) ) {
		$material = $material_terms[0];
	}
	$type_terms = wp_get_post_terms( $post_id, 'kitchen_type', array( 'fields' => 'names' ) );
	if ( ! is_wp_error( $type_terms ) && ! empty( $type_terms ) ) {
		$category = $type_terms[0];
	}

	$schema = array(
		'@context'    => 'https://schema.org',
		'@type'       => 'Product',
		'name'        => $title,
		'description' => $description,
		'url'         => $permalink,
		'sku'         => 'KR-' . $post->post_name,
		'brand'       => array(
			'@type' => 'Brand',
			'name'  => 'Кухни Рема',
		),
	);

	if ( $image ) {
		$schema['image'] = $image;
	}

	if ( $material ) {
		$schema['material'] = $material;
	}

	if ( $category ) {
		$schema['category'] = $category;
	}

	if ( $price ) {
		$schema['offers'] = array(
			'@type'          => 'Offer',
			'price'          => (float) $price,
			'priceCurrency'  => 'RUB',
			'availability'   => 'https://schema.org/InStock',
			'itemCondition'  => 'https://schema.org/NewCondition',
			'url'            => $permalink,
			'seller'         => array(
				'@type' => 'Organization',
				'@id'   => home_url( '/#organization' ),
				'name'  => 'Кухни Рема',
			),
		);
	} else {
		$schema['offers'] = array(
			'@type'          => 'Offer',
			'availability'   => 'https://schema.org/InStock',
			'itemCondition'  => 'https://schema.org/NewCondition',
			'priceSpecification' => array(
				'@type' => 'PriceSpecification',
				'price' => 0,
				'priceCurrency' => 'RUB',
			),
			'url'            => $permalink,
			'seller'         => array(
				'@type' => 'Organization',
				'@id'   => home_url( '/#organization' ),
				'name'  => 'Кухни Рема',
			),
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

	$total  = 0;
	$sum    = 0;

	foreach ( $reviews as $review ) {
		$rating = 0;
		if ( function_exists( 'get_field' ) ) {
			$r = get_field( 'review_rating', $review->ID );
			if ( $r ) {
				$rating = (int) $r;
			}
		}
		// Only count reviews that have an explicit rating value.
		if ( $rating > 0 ) {
			$sum += $rating;
			$total++;
		}
	}

	if ( $total === 0 ) {
		return;
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
