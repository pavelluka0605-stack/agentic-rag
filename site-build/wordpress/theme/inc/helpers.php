<?php
/**
 * Helper Functions
 *
 * Template helpers for Bricks Builder dynamic data and theme rendering.
 *
 * @package KuhniRema
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Format price with Russian formatting: 127 500 руб.
 */
function kuhni_rema_format_price( $price ) {
    if ( empty( $price ) || ! is_numeric( $price ) ) {
        return '';
    }
    return number_format( (float) $price, 0, '.', ' ' ) . ' руб.';
}

/**
 * Get kitchen price HTML (with sale price if available)
 */
function kuhni_rema_get_price_html( $post_id = null ) {
    $post_id    = $post_id ?: get_the_ID();
    $price      = get_field( 'kitchen_price', $post_id );
    $sale_price = get_field( 'kitchen_sale_price', $post_id );

    if ( empty( $price ) ) {
        return '<span class="price price--request">Цена по запросу</span>';
    }

    if ( $sale_price && $sale_price < $price ) {
        return '<span class="price price--sale">'
            . '<del class="price__old">' . kuhni_rema_format_price( $price ) . '</del> '
            . '<ins class="price__current">' . kuhni_rema_format_price( $sale_price ) . '</ins>'
            . '</span>';
    }

    return '<span class="price">' . kuhni_rema_format_price( $price ) . '</span>';
}

/**
 * Get minimum price for a kitchen_type taxonomy term
 */
function kuhni_rema_get_min_price_by_type( $term_slug ) {
    $query = new WP_Query( array(
        'post_type'      => 'kitchen',
        'posts_per_page' => 1,
        'meta_key'       => 'kitchen_price',
        'orderby'        => 'meta_value_num',
        'order'          => 'ASC',
        'tax_query'      => array(
            array(
                'taxonomy' => 'kitchen_type',
                'field'    => 'slug',
                'terms'    => $term_slug,
            ),
        ),
    ));

    if ( $query->have_posts() ) {
        $query->the_post();
        $price = get_field( 'kitchen_price' );
        wp_reset_postdata();
        return $price;
    }

    wp_reset_postdata();
    return null;
}

/**
 * Get active promotions
 */
function kuhni_rema_get_active_promotions( $placement = '' ) {
    $args = array(
        'post_type'      => 'promotion',
        'posts_per_page' => -1,
        'meta_query'     => array(
            'relation' => 'AND',
            array(
                'key'   => 'promo_active',
                'value' => '1',
            ),
            array(
                'key'     => 'promo_date_end',
                'value'   => date( 'Y-m-d' ),
                'compare' => '>=',
                'type'    => 'DATE',
            ),
        ),
    );

    if ( $placement ) {
        $args['meta_query'][] = array(
            'key'     => 'promo_placement',
            'value'   => $placement,
            'compare' => 'LIKE',
        );
    }

    return new WP_Query( $args );
}

/**
 * Get FAQs by category
 */
function kuhni_rema_get_faqs( $category = '', $limit = -1 ) {
    $args = array(
        'post_type'      => 'faq',
        'posts_per_page' => $limit,
        'meta_key'       => 'faq_sort_order',
        'orderby'        => 'meta_value_num',
        'order'          => 'ASC',
    );

    if ( $category ) {
        $args['meta_query'] = array(
            array(
                'key'   => 'faq_category',
                'value' => $category,
            ),
        );
    }

    return new WP_Query( $args );
}

/**
 * Get team members sorted by sort_order
 */
function kuhni_rema_get_team( $limit = -1 ) {
    return new WP_Query( array(
        'post_type'      => 'team_member',
        'posts_per_page' => $limit,
        'meta_key'       => 'team_sort_order',
        'orderby'        => 'meta_value_num',
        'order'          => 'ASC',
    ));
}

/**
 * Get reviews sorted by sort_order
 */
function kuhni_rema_get_reviews( $limit = -1 ) {
    return new WP_Query( array(
        'post_type'      => 'review',
        'posts_per_page' => $limit,
        'meta_key'       => 'review_sort_order',
        'orderby'        => 'meta_value_num',
        'order'          => 'ASC',
    ));
}

/**
 * Get global option field (shorthand for ACF options)
 */
function kuhni_rema_option( $field_name ) {
    if ( function_exists( 'get_field' ) ) {
        return get_field( $field_name, 'option' );
    }
    return '';
}

/**
 * Phone number: format for tel: link
 */
function kuhni_rema_phone_link( $phone ) {
    return 'tel:' . preg_replace( '/[^+0-9]/', '', $phone );
}

/**
 * Get kitchen count by type taxonomy
 */
function kuhni_rema_get_kitchen_count( $term_slug = '' ) {
    if ( $term_slug ) {
        $term = get_term_by( 'slug', $term_slug, 'kitchen_type' );
        return $term ? $term->count : 0;
    }
    $counts = wp_count_posts( 'kitchen' );
    return isset( $counts->publish ) ? $counts->publish : 0;
}

/**
 * Generate star rating HTML
 */
function kuhni_rema_star_rating( $rating ) {
    $rating = max( 1, min( 5, intval( $rating ) ) );
    $html   = '<span class="star-rating" aria-label="' . $rating . ' из 5">';
    for ( $i = 1; $i <= 5; $i++ ) {
        $html .= $i <= $rating
            ? '<span class="star star--filled" aria-hidden="true">★</span>'
            : '<span class="star star--empty" aria-hidden="true">☆</span>';
    }
    $html .= '</span>';
    return $html;
}

/**
 * Get related kitchens (same type, excluding current)
 */
function kuhni_rema_get_related_kitchens( $post_id = null, $limit = 4 ) {
    $post_id = $post_id ?: get_the_ID();
    $terms   = wp_get_post_terms( $post_id, 'kitchen_type', array( 'fields' => 'slugs' ) );

    if ( empty( $terms ) || is_wp_error( $terms ) ) {
        return new WP_Query( array( 'post__in' => array( 0 ) ) );
    }

    return new WP_Query( array(
        'post_type'      => 'kitchen',
        'posts_per_page' => $limit,
        'post__not_in'   => array( $post_id ),
        'meta_key'       => 'kitchen_sort_order',
        'orderby'        => 'meta_value_num',
        'order'          => 'ASC',
        'tax_query'      => array(
            array(
                'taxonomy' => 'kitchen_type',
                'field'    => 'slug',
                'terms'    => $terms,
            ),
        ),
    ));
}
