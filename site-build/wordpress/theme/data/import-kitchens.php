<?php
/**
 * WP-CLI Kitchen Import Script
 *
 * Imports 42 kitchen models from VK Market data into the WordPress CPT 'kitchen'.
 * Source: site-analysis/vk-photos-index.json
 *
 * Usage:
 *   wp eval-file data/import-kitchens.php
 *   wp eval-file data/import-kitchens.php --dry-run
 */

if ( ! defined( 'ABSPATH' ) || ! class_exists( 'WP_CLI' ) ) {
    echo "This script must be run via WP-CLI: wp eval-file data/import-kitchens.php\n";
    exit( 1 );
}

// ---------------------------------------------------------------------------
// Dry-run flag
// ---------------------------------------------------------------------------
$dry_run = false;
if ( class_exists( 'WP_CLI' ) ) {
    global $argv;
    if ( is_array( $argv ) && in_array( '--dry-run', $argv, true ) ) {
        $dry_run = true;
    }
}
// Also check via WP-CLI assoc args
if ( ! $dry_run ) {
    $extra = getopt( '', array( 'dry-run' ) );
    if ( isset( $extra['dry-run'] ) ) {
        $dry_run = true;
    }
}

if ( $dry_run ) {
    WP_CLI::log( '=== DRY RUN MODE — no posts will be created ===' );
}

// ---------------------------------------------------------------------------
// Helper: sideload a remote image and attach to a post
// ---------------------------------------------------------------------------
if ( ! function_exists( 'media_sideload_image' ) ) {
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';
}

/**
 * Download a photo from a VK URL and attach it to a post.
 *
 * @param string $url     Remote image URL.
 * @param int    $post_id Post to attach to.
 * @param string $desc    Image description / alt text.
 * @return int|WP_Error   Attachment ID on success.
 */
function kitchen_sideload_image( $url, $post_id, $desc = '' ) {
    // VK URLs have query params with sizing — get best quality by cleaning
    $clean_url = preg_replace( '/\?.*$/', '', $url );
    // Use the original URL (with quality params) for download
    $tmp = download_url( $url );
    if ( is_wp_error( $tmp ) ) {
        WP_CLI::warning( "  Failed to download: {$url} — " . $tmp->get_error_message() );
        return $tmp;
    }

    $file_array = array(
        'name'     => basename( $clean_url ),
        'tmp_name' => $tmp,
    );

    $attachment_id = media_handle_sideload( $file_array, $post_id, $desc );
    if ( is_wp_error( $attachment_id ) ) {
        @unlink( $tmp );
        WP_CLI::warning( "  Sideload failed: " . $attachment_id->get_error_message() );
        return $attachment_id;
    }

    return $attachment_id;
}

// ---------------------------------------------------------------------------
// Helper: classify kitchen type from description
// ---------------------------------------------------------------------------
function classify_kitchen_type( $desc ) {
    $desc_lower = mb_strtolower( $desc, 'UTF-8' );

    if ( preg_match( '/п[\-\s]?образн/ui', $desc_lower ) ) {
        return 'p-obraznaya';
    }
    if ( preg_match( '/(угловую|угловая|угловой|углов)/ui', $desc_lower ) ) {
        return 'uglovaya';
    }
    if ( preg_match( '/(прямую|прямая|прямой)/ui', $desc_lower ) ) {
        return 'pryamaya';
    }
    return 'pryamaya';
}

// ---------------------------------------------------------------------------
// Helper: classify kitchen style from description
// ---------------------------------------------------------------------------
function classify_kitchen_style( $desc ) {
    $desc_lower = mb_strtolower( $desc, 'UTF-8' );

    if ( preg_match( '/(неоклассик|классик)/ui', $desc_lower ) ) {
        return 'klassicheskij';
    }
    if ( preg_match( '/(лофт|индустриальн|бетон)/ui', $desc_lower ) ) {
        return 'loft';
    }
    if ( preg_match( '/(минимализм|современн)/ui', $desc_lower ) ) {
        return 'sovremennyj';
    }
    return 'sovremennyj';
}

// ---------------------------------------------------------------------------
// Helper: classify kitchen material from description
// ---------------------------------------------------------------------------
function classify_kitchen_material( $desc ) {
    $desc_lower = mb_strtolower( $desc, 'UTF-8' );

    if ( preg_match( '/глянц/ui', $desc_lower ) ) {
        return 'glyanec';
    }
    if ( preg_match( '/(дерев|шпон)/ui', $desc_lower ) ) {
        return 'massiv';
    }
    if ( preg_match( '/(матов|мдф)/ui', $desc_lower ) ) {
        return 'mdf-plenka';
    }
    return 'mdf-plenka';
}

// ---------------------------------------------------------------------------
// Helper: extract dimensions from description (e.g. "3.2 м", "2,8 м")
// ---------------------------------------------------------------------------
function extract_dimensions( $desc ) {
    if ( preg_match( '/(\d[\d.,]*\s*[xх×]\s*\d[\d.,]*\s*м)/ui', $desc, $m ) ) {
        return trim( $m[1] );
    }
    if ( preg_match( '/(\d[\d.,]*\s*(?:п\.?\s*м|погонн))/ui', $desc, $m ) ) {
        return trim( $m[1] );
    }
    if ( preg_match( '/(\d[\d.,]*\s*м²)/ui', $desc, $m ) ) {
        return trim( $m[1] );
    }
    return '';
}

// ---------------------------------------------------------------------------
// Helper: clean description — remove emojis and VK-specific text
// ---------------------------------------------------------------------------
function clean_description( $desc ) {
    // Remove common VK call-to-action patterns
    $desc = preg_replace( '/➤.*$/us', '', $desc );
    $desc = preg_replace( '/Хотите так же\?.*$/us', '', $desc );
    $desc = preg_replace( '/Напишите нам.*$/us', '', $desc );
    $desc = preg_replace( '/ht$/us', '', $desc ); // truncated URL fragment

    // Remove emojis (Unicode emoji ranges)
    $desc = preg_replace( '/[\x{1F600}-\x{1F64F}]/u', '', $desc ); // emoticons
    $desc = preg_replace( '/[\x{1F300}-\x{1F5FF}]/u', '', $desc ); // misc symbols
    $desc = preg_replace( '/[\x{1F680}-\x{1F6FF}]/u', '', $desc ); // transport
    $desc = preg_replace( '/[\x{1F1E0}-\x{1F1FF}]/u', '', $desc ); // flags
    $desc = preg_replace( '/[\x{2600}-\x{26FF}]/u', '', $desc );   // misc symbols
    $desc = preg_replace( '/[\x{2700}-\x{27BF}]/u', '', $desc );   // dingbats
    $desc = preg_replace( '/[\x{FE00}-\x{FE0F}]/u', '', $desc );   // variation selectors
    $desc = preg_replace( '/[\x{1F900}-\x{1F9FF}]/u', '', $desc ); // supplemental
    $desc = preg_replace( '/[\x{200D}]/u', '', $desc );             // ZWJ
    $desc = preg_replace( '/[\x{20E3}]/u', '', $desc );             // combining enclosing keycap
    $desc = preg_replace( '/[\x{FE0F}]/u', '', $desc );
    $desc = preg_replace( '/[✅⚪⚫⚜️☕️⚡️✨🌀🌾🌿🌊🖤🌟🔝💬🍳🛋️🏠🏙️🏗️📺📐🌳🌲🪵🗜️🍸🌑🌪️🌫️🌰⚙️🎶🌅]/u', '', $desc );

    // Remove leading/trailing whitespace and collapse multiple newlines
    $desc = preg_replace( '/\n{3,}/', "\n\n", $desc );
    $desc = trim( $desc );

    return $desc;
}

// ---------------------------------------------------------------------------
// Kitchen data from VK Market (site-analysis/vk-photos-index.json)
// ---------------------------------------------------------------------------
$kitchens = array(
    array(
        'product_id'  => 11263064,
        'title'       => 'Кухня Сантьяго',
        'price'       => 197000,
        'description' => '✅ Кухонный гарнитур «Сантьяго»: Элегантность без ручек и барный рай ⚪️🍸  

Представьте П-образную кухню, где барная стойка плавно «вытекает» из гарнитура, а фасады открываются легким прикосновением. Именно такой проект мы создали для семьи Ксении и Дмитрия из Красноярска, которые мечтали о пространс',
        'photos'      => array(
            'https://sun9-62.userapi.com/s/v1/ig2/u3IeLdobAbM3Em-AJRzT7LS03pit4RjG4hBdgpaMkiuSN92EpjP6ROh922IKX0xTjM4aeqQ-qUs3jpPk0R_Xtu3-.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x199,240x299,360x449,480x598,540x673,640x798,720x897,1080x1346&from=bu&cs=1080x0',
            'https://sun9-51.userapi.com/s/v1/ig2/186FdEVD32Vu0RrY6ql8WXgenNmmSpCRxKXLVK3Fa-TMlBeoaLtT2OHgy5xz7R55wjTBY8Om_eBMrnhiL3PgtUSw.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x199,240x299,360x449,480x598,540x673,640x798,720x897,1080x1346&from=bu&cs=1080x0',
            'https://sun9-63.userapi.com/s/v1/ig2/BwN6zDbgAqwaRCcZoJEQEZ1bTHV_uYLB_Oa4W0CFjL-GgZ27Prm0k2SdVbwUZaSfnCBVQHc04tBKnBU1ypvzZBFv.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x199,240x299,360x449,480x598,540x673,640x798,720x897,1080x1346&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11263044,
        'title'       => 'Кухня Морано',
        'price'       => 199000,
        'description' => '✅ Кухонный гарнитур «Морано»: Элегантность волн в каждой детали 🌊🖤  

Представьте угловую кухню-гостиную, где матовые поверхности переливаются светом, а плавные линии фрезеровки напоминают морские волны. Именно такой проект мы создали для семьи Марины и Игоря из Красноярска, которые мечтали о гарнит',
        'photos'      => array(
            'https://sun9-72.userapi.com/s/v1/ig2/vcElgPGj1Ii9KbYKiLOl3aYGwdJEjVlDvKNXmNMvG0r1IPCcdgE_gV64YhnnpC5ZzCwDVlmG-UXA8PKm13kFGVoV.jpg?quality=95&as=32x39,48x59,72x89,108x133,160x197,240x295,360x443,480x591,540x664,640x788,720x886,1080x1329&from=bu&cs=1080x0',
            'https://sun9-22.userapi.com/s/v1/ig2/5ZPT4wp13Omv3a4OQfYF-6Iy68yYRIg-e2ynRsBnDnYHfSLxV0KHTvuEoaNLLcUuyq_o9dxH6swIXsaGSqdDxFX_.jpg?quality=95&as=32x39,48x59,72x89,108x133,160x197,240x295,360x443,480x591,540x664,640x788,720x886,1080x1329&from=bu&cs=1080x0',
            'https://sun9-49.userapi.com/s/v1/ig2/d550FyGPeNFcKUGPseKxXc5msb4YD9eKmrQZL_5jUodj0MkNZBIhR9rt7OIvmNsQ-9AZK_rJZAsELIqifm8gwUGl.jpg?quality=95&as=32x39,48x59,72x89,108x133,160x197,240x295,360x443,480x591,540x664,640x788,720x886,1080x1329&from=bu&cs=1080x0',
            'https://sun9-41.userapi.com/s/v1/ig2/4GzdaeZO8LYYOUWMKkc8jV6BMkRHFlN1CSZ1ZqvQympMz-aTEJe1cE1RiYFxGuvtcxBJa49LIvU9nI8YKsp6tYle.jpg?quality=95&as=32x39,48x59,72x89,108x133,160x197,240x295,360x443,480x591,540x664,640x788,720x886,1080x1329&from=bu&cs=1080x0',
            'https://sun9-57.userapi.com/s/v1/ig2/4wZIA2HeMKrAHrcTMlIgctv4v8_ogP9bSEhP4rlra0rBy3EfLXuudRQ2iYZ2X8yEimXOI6FXoJEI71SNwXUxxjWG.jpg?quality=95&as=32x39,48x59,72x89,108x133,160x197,240x295,360x443,480x591,540x664,640x788,720x886,1080x1329&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11263036,
        'title'       => 'Кухня Лаваца',
        'price'       => 195000,
        'description' => '✅ Кухонный гарнитур «Лаваца»: Минимализм с интеллектом 🌑✨  

Представьте кухню, где применены графитовые фасады Graphite Lux, встроенная подсветка, а каждый элемент продуман до мелочей. Именно такой проект мы создали для Алексея, который хотел современное пространство для работы и ужинов с друзьями.',
        'photos'      => array(
            'https://sun9-38.userapi.com/s/v1/ig2/70srWAkBte4OP7irWRBd5MUKiCkVIAxmF_54IZA6V8AO1aHLi-K2KLEkKjxXMBboEay9HraZIbQannweqRW0kr2A.jpg?quality=95&as=32x37,48x56,72x83,108x125,160x185,240x278,360x417,480x556,540x625,640x741,720x834,1080x1251&from=bu&cs=1080x0',
            'https://sun9-53.userapi.com/s/v1/ig2/8brvno0UaQxTxLv36KyannMMmfgd16ZhZii1qx2Bo1jXtbFM-_v-jgspbGXeD5TDvdl_zXZsMKHB0mBmsFhCsZnd.jpg?quality=95&as=32x37,48x56,72x83,108x125,160x185,240x278,360x416,480x555,540x624,640x740,720x833,1080x1249&from=bu&cs=1080x0',
            'https://sun9-73.userapi.com/s/v1/ig2/Iu1hVSRiyXh4HeD0CNtLbUyYueWVcWuKNOgbAdSC-1pPAQr7auRudba12xYJdT9e2lDLL9ws6TQckmEAzmA3W6o5.jpg?quality=95&as=32x37,48x56,72x83,108x125,160x185,240x278,360x417,480x556,540x625,640x741,720x834,1080x1251&from=bu&cs=1080x0',
            'https://sun9-29.userapi.com/s/v1/ig2/l6SUmKNlUQuvduK7k79AibWQTNQispMhBefK1DEAGBeiXF8ynXVFOVg5xlzmBxwHyh3TlRf6KrKFCfOSBYzNc6Qx.jpg?quality=95&as=32x37,48x56,72x84,108x125,160x186,240x278,360x418,480x557,540x626,640x743,720x835,1080x1253&from=bu&cs=1080x0',
            'https://sun9-70.userapi.com/s/v1/ig2/YbA85akQJj8WI4PplDjRG9-_T_6uTpOODDOccXbms59FyoBGr5VQ9SaUP7tuKToT4jTrp1u-zixCXUq99O8hbYOz.jpg?quality=95&as=32x37,48x56,72x84,108x125,160x186,240x278,360x418,480x557,540x626,640x743,720x835,1080x1253&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262957,
        'title'       => 'Кухня Портленд',
        'price'       => 277000,
        'description' => '✅ Кухонный гарнитур «Портленд»: Скрытая функциональность и элегантность ⚪️🖤  

Представьте угловую кухню, где белизна фасадов сливается с потолком, а чёрные акценты добавляют графичности. Именно такой проект мы создали для семьи Анны и Михаила из Красноярска, которые мечтали о гарнитуре, где каждая ',
        'photos'      => array(
            'https://sun9-41.userapi.com/s/v1/ig2/rMPjHfS5z_v2HhPS2hRWiC2HtkjihjF4lKiHlkfcsDOuj51LrPfozHCTfqageUacm1gpvf0y-umaFUijMaxdYCEL.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-33.userapi.com/s/v1/ig2/n-l70ymED0ZBxdoxm-Fk-lljnMvUR__ta4ltngARU2XwnEPSnNtlEE1jFSCq9u-sgbDSb_NM4qiun63EP5iCQD8C.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-11.userapi.com/s/v1/ig2/IPm66b5fU-Ny7D3vzOpBB2LpavA_EBR3ZqhG9dBFjXPHd7-Hp_KGMiUwZpxfVo0O55kChR55sdgjgksK25HBfz-z.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-88.userapi.com/s/v1/ig2/hwNE4T97OisV15C2GzQwSkencT6iSBSSobK-kakrQkH488F8wMVDILvgYJBqnAVqcac3UL2dXwhnd2aPcWrGtOFD.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-44.userapi.com/s/v1/ig2/RqAwPCjbLZ1TBiNQ5Ibf7yjHNC0qNef8a5fnoX2VMvpk5dwq1MoY4SavvuLzROU7_7SAdAuksILPN653hgBYioi9.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262954,
        'title'       => 'Кухня Пунто',
        'price'       => 298000,
        'description' => '✅ Кухонный гарнитур «Пунто»: Брутальность и элегантность в деталях 🌑🪵  

Представьте прямую кухню, где глубокий графит фасадов сочетается с теплотой натурального дерева, а каждый элемент подчеркивает мужской характер интерьера. Именно такой проект мы создали для Дмитрия из Красноярска, который хотел',
        'photos'      => array(
            'https://sun9-51.userapi.com/s/v1/ig2/rvMdW0JzFff5iJs1pyvWwdeFJJOiyb8QxDLpe_-ip44PaPigIWrQw50kuOxLKgIixssXV8HSy07SGnIEk2J-otHH.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-29.userapi.com/s/v1/ig2/aRcEO_dPf8QU33aaUyK8H9ALtLVfHb4m_-vP6p8raPPCZgeSrRzI0uyNgMyLi9so7-3qZzHAOOCVW58RZhXXVdbv.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-64.userapi.com/s/v1/ig2/_Q5vlcrJJ7AVYiJJvRk0I_VVe8A83dIxEs8SWf0tCAFO9P-PebAUsANbcDOMclpto-Guqb7kDaPOfKv614Kqmxks.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-63.userapi.com/s/v1/ig2/2ybaP3teuVRPmN2blKVmelsaj4yNfReM2fHz9ddKX9MhXUhMdK5SNIKWzlG00v186tS1euvf2MyYDIE7GUuwGkbY.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x674,640x799,720x899,1080x1349&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262952,
        'title'       => 'Кухня Залано',
        'price'       => 293000,
        'description' => '✅ Кухонный гарнитур «Залано»: Роскошь в каждой детали 🥛✨  

Представьте кухню, где молочная нежность фасадов переливается под светом золотых акцентов, а остров становится сердцем пространства. Именно такой проект мы создали для семьи Софии и Артёма из Красноярска, которые мечтали о гарнитуре, сочета',
        'photos'      => array(
            'https://sun9-70.userapi.com/s/v1/ig2/vINC-0ZS7JQy017tsa0QcpnF74beVxM5cqovyrykoLn5jbqtGLkjC951gfe1H6vX_z6zODfJRvchAw9y493H_ILb.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-66.userapi.com/s/v1/ig2/3fvuoceXlzpdBXSKF1bH-eBbb4bW5TZMbmPo7mMXrbZO5MVxzBH1y2dLGuw9lYDWj65XsgHiODUizDHs_rwWTRSK.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-14.userapi.com/s/v1/ig2/NKabNQPDramXX4KwlK3LmHRnkpfjrsNL56y7p5fUfd_nqExiEYJpu2XD32K0F5CnWaLo0Yu8YNFirHA80Jg9V7ds.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1020x1020&from=bu&cs=1020x0',
            'https://sun9-12.userapi.com/s/v1/ig2/PUOGZPcNPe0TyzcNvBLP7Lq5pF8E3fO5QWL1spF7F5ZkEpznzh_9Y6iFWhCBnKQBuSsNbGgbCtxkxDgLLq79mVzy.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-55.userapi.com/s/v1/ig2/omOEmWhmriuN7tce-XbCLq3t20jHwxI21jkD-jG8ld34Ji-W1Sp1LLSH5QXu28Oo7JFRDjBiY3j9TeQwz_UpQ8WZ.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262940,
        'title'       => 'Кухня Габана',
        'price'       => 234000,
        'description' => '✅ Кухонный гарнитур «Габана»: Нежность и функциональность в каждой детали 🌸🖤  

Представьте угловую кухню, где мягкие пастельные оттенки фасадов создают уют. Именно такой проект мы реализовали для семьи Елены и Алексея из Красноярска, которые мечтали о пространстве для семейных ужинов и спокойных за',
        'photos'      => array(
            'https://sun9-36.userapi.com/s/v1/ig2/QVL5gXTJohzCSu1qLXOrysmVw_LPGJLqEwzWwOpvJWJWrAU6Cyr3wAEy-1Vg1VJ1y8BFujn3rIqAsqcZlcMTLNEY.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-40.userapi.com/s/v1/ig2/gXlNXjsYDmzI5XfvXNJdmoA0ctTId8J521Rj6pJPE8QH1YuDKnidn4Y5IkthAHLpix0nmUjx1LZVd2qylHjzb_Xh.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-17.userapi.com/s/v1/ig2/6tr4gce5RmwRtBn5JAVpUTgMToP27jIGCz-g6ssXfnix4HhhdItFc3RIc1BSwsiBCvSUdgz6DcJ1JhrAqdxa5Nbg.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-35.userapi.com/s/v1/ig2/fqCFUwIpHd6q2lDfJBafx60PrqRDVf_0ae12D2VxQqOgy6WeRZUqqfgOTOc2u3MdAecDyNCsWTquu5NobdFoHnHs.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-45.userapi.com/s/v1/ig2/J-6kZaaigMRQtTs4M7nNhsYjTnGXElrJ2MxwFErb6XTYCxVXsgD_nxwk2fSN0BaD7GqXKajJmZ7HGoZ-iLi7Wov_.jpg?quality=95&as=32x40,48x60,72x90,108x134,160x199,240x298,360x448,480x597,540x671,640x796,720x895,1080x1343&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262905,
        'title'       => 'Кухня Элеганс',
        'price'       => 246000,
        'description' => '✅ Кухонный гарнитур «Элеганс»: Теплота природы и чёткие линии 🌳⚫️  

Представьте угловую кухню, где глубокий оттенок светло серого» гармонирует с натуральной текстурой дерева, а каждая деталь продумана до мелочей. Именно такой проект мы создали для семьи Ольги и Игоря из Красноярска, которые хотели ',
        'photos'      => array(
            'https://sun9-47.userapi.com/s/v1/ig2/VkkcHYQCLeLnO7UrhUVyKHI9t5Il9mR9j1FfM4Hk8T_gJ5LIp2hD14Jz3-aw9ynXS4xDnJtIr-EE7epBi-ZzmeXd.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-74.userapi.com/s/v1/ig2/OhuVmEf6gnweftTHSFdtMs3huNtuTDnr04sI71JOLa8nlhoQfXjB-IL1KBOYD6DzaE26F8CxEsyj2QQkK_BHAnaR.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-52.userapi.com/s/v1/ig2/9F3bjAYa5LDekylJMDzBXtjoEXGZihA016Q63JOFABjgVggJD6QBawljJ6LMmFDIOkGOjpCYXEn2U7N3eU9vRg_J.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-56.userapi.com/s/v1/ig2/_xXfA8pt6BpiFyLnLVDOqGMn6D6K3TaRiW1MSoNt5C7CmsOEDprz2SnrRNBrNY9J4hfJDYJ9kveoIDI-NwMTK5v3.jpg?quality=95&as=32x40,48x60,72x90,108x134,160x199,240x298,360x448,480x597,540x671,640x796,720x895,1080x1343&from=bu&cs=1080x0',
            'https://sun9-71.userapi.com/s/v1/ig2/gFPaU7kqBRvZm0K1qlMniKwO87C69Vmb9UVqtjWUJOicKPYfvTbPpeLhqjWJOBrSH4JWc0Lms-n1BYcXF30AkzAS.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262826,
        'title'       => 'Кухня Кармен',
        'price'       => 236000,
        'description' => '✅ Кухонный гарнитур «Кармен»: Блеск и функциональность в каждой детали ✨🏙️  

Представьте угловую кухню, где глянцевые фасады отражают свет, а вентиляционная шахта становится изюминкой дизайна. Именно такой проект мы создали для семьи Екатерины и Павла из Красноярска, которые мечтали о современном п',
        'photos'      => array(
            'https://sun9-83.userapi.com/s/v1/ig2/nLf4Zq9e0u_bbjoZbP1OLd_uBI9x-lG5vgGiTZRA2afkVZRS3bFyuyosA4OiVfBObdVe4x7VCfx87EGZjOF1ADGP.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-10.userapi.com/s/v1/ig2/cepnwgnTVTBNbsfCz1y0wlOq8OuAXwcQTFV20OnYfKeV6MJx8n9qycBJO7YynBCyAYmJfG-p4-0KPcw9m4YjtdYu.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-45.userapi.com/s/v1/ig2/pciA9hhUxtPG8PEROBrT-wKEjh8ikoqd8hTzuNdnasKg2DcjO_PGeCyl8-W_Dg1wdwYL3W0qlHuNurajCsfiwmJd.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x271,480x361,540x406,640x481,720x541,1080x812&from=bu&cs=1080x0',
            'https://sun9-40.userapi.com/s/v1/ig2/xTN9YTRDRkvHWuNPwdEsTvrtAz7K7sA_SlokJ_BSGB6bh3Wo2-M9NIp5Su7VRLJB8gyXGgWXxUW_xppLUVlSbFsk.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262888,
        'title'       => 'Кухня Савора',
        'price'       => 342000,
        'description' => '✅ Кухонный гарнитур «Савора»: Контраст технологий и элегантности ⚪️🖤  
Представьте кухню, где белизна фасадов перекликается с мягким свечением стеклянного пенала, а два холодильника работают в идеальном тандеме. Именно такой проект мы создали для семьи Анны и Максима из Красноярска, которые мечтали ',
        'photos'      => array(
            'https://sun9-64.userapi.com/s/v1/ig2/NnMH96A-DiD4qe7FCCpwRDeS2baTS7WUtY6J96UXLXBb6lRsqy_GwKX0nuFDWcm73ovE-3r32H084SAgIP8G3dz7.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-67.userapi.com/s/v1/ig2/mNO7Fe_zfpm98KKDpEKTRl3V7B66DDE8_EpHfg8upQjmiXGAu9eCBXLmK8v74HpTqTw3rXEacnuhNGAgIZ8MwEKh.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-61.userapi.com/s/v1/ig2/dfYkLE-doCpCcIkvT07yZTzc-vCRLWH-QNW7dnrv8u_jdvfJJYpcRmz0eo_3ojnPJIV7DD1mpCR3WN0r0pm7K_kY.jpg?quality=95&as=32x40,48x60,72x90,108x134,160x199,240x298,360x448,480x597,540x671,640x796,720x895,1080x1343&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262807,
        'title'       => 'Кухня Бронсо',
        'price'       => 245000,
        'description' => '✅ Кухонный гарнитур «Бронсо»: Мощь бетона и лёгкость эргономики 🌪️🏗️  

Представьте угловую кухню, где индустриальная эстетика сочетается с продуманным комфортом, а каждый ярус работает на вашу удобство. Именно такой проект мы создали для семьи Дениса и Алины из Красноярска, которые мечтали о простр',
        'photos'      => array(
            'https://sun9-62.userapi.com/s/v1/ig2/DZ0xvLss9GjupM8vgr6Y863cXj7nYmZbozWvKwi4MjEgEgmBzllkoSqUDcze57hf-TQyK-Wcay4zDwxqCkw-EMt_.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-63.userapi.com/s/v1/ig2/0cv-NxzUj-X3mFTXCfVLiKCVt9TNK0e5WWYl12IqjRceMtF7ea-pN3j0HELrU0oKs3Qbw4LtuSWwaCqo8crLGSBS.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-60.userapi.com/s/v1/ig2/Ck5Uh7KKx_Pj7o-8ZMdI2xMw7KfVHtBfeBRfpUnAZv3Ma58hSoqhTz5VQXyTO57NcjbFXhbi18BzuEA50OG4BwnX.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-23.userapi.com/s/v1/ig2/hTucKZEy8RbWXGoM1RTrxpN4_2ey9_V3oVcT4JRfXI4qr5WsF4DAQM3Cb-NC0SzCN9WTDF-mdY8YR9OEkBuPLfxe.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-60.userapi.com/s/v1/ig2/yRx8CGaAeT6GBftXWRutpQV7EPMkruqOC8fLx-NrwmJcUtMQrr9IGRVV0S-isg7a52Ynl-dgngXQOip4XdkCZJaQ.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262735,
        'title'       => 'Кухня Акрона',
        'price'       => 254000,
        'description' => '✅ Кухонный гарнитур «Акрона»: Порядок и стиль в каждой линии ⚫️📐  

Представьте прямую кухню, где каждая деталь работает на функциональность, а техника скрыта за строгими фасадами. Именно такой проект мы реализовали для семьи Марии и Андрея из Красноярска, которые мечтали о гарнитуре без лишних дета',
        'photos'      => array(
            'https://sun9-55.userapi.com/s/v1/ig2/KgXo4YBJRNKsTtkyDmyf131YghTVkiET3QSBen9ZezWcq21lYTOaIbHX5r9bcZhoeeFXD_mAJbxElJLFuMO-_oW4.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-63.userapi.com/s/v1/ig2/dENvNDkKkGGOhx_phOvXCeVIrM9-_l06YjAs4-H1vA7Lkzv2JG-7qc5zA_nhsC3q1vXwdmaq07jGVTqij1fMsrnW.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-62.userapi.com/s/v1/ig2/4jQPPUNO6O1iZQQsqMioYyYKz9aowS9GVDkxYrqZZ3O6y0DgrspYXzGOyunRQFOxHL3x9vHwSLjmO4UCam8DY6L9.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-70.userapi.com/s/v1/ig2/dXWdnUNTPCUycI0cJD_s20YAn7I2rZ-sybw9SlkHLTlLO8j893Epaou6uQTK3Ox-xP7h2DJLbkc_6bvhjaJKtOSV.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-88.userapi.com/s/v1/ig2/e8BBxbj5m1naabgOJ6OVeW2hEBtzVVve0f7Si0PKvHLPuBnn8XMkuYdkmaUFpnkjssicCA8iXxdspohYrVWWAJR3.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262723,
        'title'       => 'Кухня Рамона',
        'price'       => 219000,
        'description' => '✅ Кухонный гарнитур «Рамона»: Минимализм с интеллектом ⚪️🎶  

Представьте угловую кухню, где белизна фасадов сливается с потолком, а встроенная техника работает как часть гармоничного ансамбля. Именно такой проект мы создали для семьи Ксении и Артёма из Красноярска, которые мечтали о кухне без визуа',
        'photos'      => array(
            'https://sun9-17.userapi.com/s/v1/ig2/nw4HPOXm_3QFRYAkqDAtMfBubk9Q7BUCu4ieiqZSgroR0C0QAn-jOE74AFpb4J9mOa3V0qYuPzCHF6SZLlIp02PN.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-77.userapi.com/s/v1/ig2/1KOPgQ3nqPooukgUyYj5YXX21uYysvmbO9WhBSQdzBtfFBVXhA845zSZ7gMcD_LJp588qwJOnacHoQ2QK3-ge1Vm.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-58.userapi.com/s/v1/ig2/-TUOw8k2BaJR6KceiyZt9Na_Zc2Xb0ltubNlu7B7Kln7wOw7Y2KK5y3-LJJDzA5MJybbtjqJApqAAjnpNcQ88KS8.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-29.userapi.com/s/v1/ig2/UOp1omNoxpTPPmfw_iplLljJp3Y3J5t1995AJNFh0x4RvfnQ4LrO3d02qig-x1zSyHBpA4LdkiQwkAfJva4iiHOL.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-87.userapi.com/s/v1/ig2/SHil6A2y2CGf0yMqSle3u-IMhUWIkHFvtqvR0KSHYyP59aBjHlWBOI-tt9DMK3g04rBIvMas6R9GP7mIfrjceHUC.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262716,
        'title'       => 'Кухня Флока',
        'price'       => 231000,
        'description' => '✅ Кухонный гарнитур «Флока»: Уголок, где каждая деталь на своём месте ⚫️🌀  

Представьте угловую кухню, где холодильник «растворяется» в гарнитуре, а вентиляционная шахта становится частью дизайна. Именно такой проект мы реализовали для семьи Анны и Михаила из Красноярска, которые хотели функциональ',
        'photos'      => array(
            'https://sun9-73.userapi.com/s/v1/ig2/EqRJlMNLU_O0Xhj0VNV4JhYw5nEqhiuCerIxh1KmGB7C59KJoCJhgWpregD0Lt1Udi8TrNfnWQS6WsvoXAwoc_HC.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-18.userapi.com/s/v1/ig2/7Pv6nvvGm7N522vjwNvUKgbIkftUEJ17JC_eCx2rGkzG9zPwoHVEj6QKYr7Lvu07tjFi6VJX73Nq4IbcYgDpf1R2.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-56.userapi.com/s/v1/ig2/NtbD-9VGUPsKZ-3z1Ddizx9G4sug-RjSBvsWCIUhMUzJmnQQ0MGJVXQFfdNGUnKxKWES-muThthiGldhl_wBaTeX.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-51.userapi.com/s/v1/ig2/sEce5VLX9He5UdkWXEXJEnvOguhjBLGdTdSPxC6uYSwgcF2caabDNCGMfAZY1s-sy3H_rzJlD3Om7YVSmg_MU50c.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262704,
        'title'       => 'Кухня Коста',
        'price'       => 295000,
        'description' => '✅ Кухонный гарнитур «Коста»: Угловая кухня с чёткой геометрией 🌲⚫️  

Представьте угловую кухню, где теплые оттенки дерева сочетаются с гранитными линиями, а каждый сантиметр работает на ваш комфорт. Именно такой проект мы создали для семьи Ирины и Дмитрия из Красноярска, которые хотели совместить у',
        'photos'      => array(
            'https://sun9-51.userapi.com/s/v1/ig2/2amhQ4CoCFVbEouqvHHktBrA_VOIAyh_itL8NlE6SJIS9DO0ldywqWOqiaxWWqSBufbg0IYZqVnFMsf7xvN1RnmI.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-35.userapi.com/s/v1/ig2/YwAttRc1z6xrY_LgeZt4x3JyyN0o4HX0ccrslFGnXMSWbEHWQ0fpeNFELEqFurCnhiRxg43x3yHJRerlJy6JaVt9.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-31.userapi.com/s/v1/ig2/JNoPp7rvMxMinHz7Wdq59IGdipbNUFLAPRCt6_TYdmJMg4yVsPfp02iSD-5-LUaAEo_9RLFrCnwULYo4D4fx9i85.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-70.userapi.com/s/v1/ig2/vUoLKiTilFRuENIA_lAZFwLFbhlxZdWJgWNL9aI0BlLiuM_hKkh-22VoKzF8myTrKDfTwfJXci6y4VYNAMXCsrod.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-76.userapi.com/s/v1/ig2/Mmmov1WUy-yjbC9iGLZj-TE0sxu0H3I_JWMNAweH24lFtAU1zpS51owlpRWof5k582igVzgdMx55FW4bQhVHmm2R.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262699,
        'title'       => 'кухня Флора',
        'price'       => 366000,
        'description' => '✅ Кухонный гарнитур «Флора»: Эргономика масштаба ⚫️🗜️  

Представьте большую кухню, где каждая деталь работает на ваш комфорт, а линии гарнитура сливаются в идеальный рабочий треугольник. Именно такой проект мы реализовали для семьи Виктора и Алины из Красноярска, которые хотели совместить роскошь, ',
        'photos'      => array(
            'https://sun9-59.userapi.com/s/v1/ig2/J6tg6pYOkcs1I3968_xpIhtQ8t9sEzKj1OPLAFXYLLVUXXHeK1HvD834DwL7jlY33BSGi2AIwGnOQbC-6X6wEdf4.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-72.userapi.com/s/v1/ig2/wI1M2KGAPLnH_V1L26f7m0GsKPBaqJJgNgX0KvBU_n7y3jSAfWleWNRC0-XtTQIdXUYpKrQVo3-3YXyY5u62GPAL.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-20.userapi.com/s/v1/ig2/al4WUllBsCUIxKdqzqtDu3sa3ReBGLhffrVdL9-LwBJiOT36s3KUiiuA46jDr-gHNIY28fBrpmO1Frj2LQ83-c5b.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-84.userapi.com/s/v1/ig2/6hWvGChcsszvuTyISDbr7NM3-yVJrmL3KQv8evInG62CYs-YWMR8rrknjm1AhLoYSya_37Qx7DSYM1aVQLM7Pyyk.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-84.userapi.com/s/v1/ig2/TdD1aZgrPT6z2LPLajKAWNR8VsheBwq0gzjCmzDDM_4jv40t32_a7f-q5RbpOObxbXAS5hgnfiamnA8StuakyoJG.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262670,
        'title'       => 'Кухня Ромика',
        'price'       => 245000,
        'description' => '✅ Кухонный гарнитур «Ромика»: Гармония практичности и вида из окна ⚪️🌅  

Представьте кухню, где утреннее солнце освещает идеально чистую столешницу, а все необходимое — от холодильника до мойки — под рукой. Именно такой проект мы создали для Ольги из Красноярска, которая мечтала о светлом пространс',
        'photos'      => array(
            'https://sun9-83.userapi.com/s/v1/ig2/_FH4nv5EdNgC4iQjaK9F9r75UieMuv2BMkQocmRKL87YiR9Pa1LAoSYhfdlalNa63cBw6JTKRXtqZ_klEIQzXoCy.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-14.userapi.com/s/v1/ig2/DgEguOr9KGkcIi0WiF3PDvlU_Lz_gzhSafULT4uRjeTTpD5_3bsr7Z2IBuv1vdwGL20xCQhRsaWe84NI7C0aTFmc.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-61.userapi.com/s/v1/ig2/pS9SQANt-biBT0u1FS2XTlqlGWzSxMT0kBmM8onp_g3q3ZKFa2dbEwIEhGuKYIwgooAl0Uv2rgMgTQHBzWCXCYYY.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-22.userapi.com/s/v1/ig2/Pbgxtrs0s12rnorcEiCMAMxGPQfU1D9Z8elSsYoffnoyCRTRiSr8nK3q0nJkwTXbcErG2G2uIX9PcGYGRR_Azy19.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-1.userapi.com/s/v1/ig2/90qOQDxtHlWEauDtPGg9AAFDsTpNWTp3pd_vk2toW16uebtYJLx-TlaV--H3nSAueaQS14-pPNrLFv4q4T7Pi0qN.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262620,
        'title'       => 'Кухня Импульс',
        'price'       => 323000,
        'description' => '✅ Кухонный гарнитур «Импульс»: Технологии и порядок в каждой детали 🌑⚙️  

Представьте прямую кухню, где графитовые фасады сливаются с техникой, а скрытые механизмы работают как часы. Именно такой проект мы сделали для семьи Алексея и Татьяны, которые хотели совместить бытовой комфорт с эстетикой со',
        'photos'      => array(
            'https://sun9-77.userapi.com/s/v1/ig2/bOjOVyU2X1_I269AHQnJdDphlfTuYy72IN2dsPNKk4itNeH19zLhVr0SyJFcu0wxf5QNJ7JKVhPhgODozVHevAry.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-84.userapi.com/s/v1/ig2/6jJuVFLKU64cxXtLgNn1iqVP8mn5ZWRymrb6aPVmu26nUfndAgs_9gY4apG8ndTuEtnAY-QCQPWA99ORJemeAnH6.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x271,480x361,540x406,640x481,720x541,1080x812&from=bu&cs=1080x0',
            'https://sun9-61.userapi.com/s/v1/ig2/wsWv91NX3x8QBBzjj_G5CDxP-LwT11i2QRN8JTHsQE5W8fOSMWxIYelUiM-ZMgZl0BQyVnQKPNmfGmcuWTt9_K5P.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x271,480x361,540x406,640x481,720x541,1080x812&from=bu&cs=1080x0',
            'https://sun9-31.userapi.com/s/v1/ig2/c6t3wlek14M4o-qilFOt-U51DU0tPpHNayg3ZreSxSJlJyQGh5Ifsmxg7PCDSbzotW0OdLSb4VbRB9-Up-h-5lqp.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-7.userapi.com/s/v1/ig2/_dclpedDRDrMf3eh-o2kjhnI8fWQn-JI1pmeCRMjyhgBb5yKcCQnIkhdqjs4JmIVdm_zTSl6-5_oWfRIrVTbvFUI.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x271,480x361,540x406,640x481,720x541,1080x812&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262568,
        'title'       => 'Кухня Белла',
        'price'       => 294000,
        'description' => '✅ Кухонный гарнитур «Белла»: Светлая геометрия с тёплым характером ⚪️🌰  

Представьте кухню, где белизна фасадов подчеркивает простор, а тёмное дерево добавляет уюта. Именно такой проект мы создали для семьи Вероники и Дениса, которые мечтали о современной кухне без стерильности и с чёткими акцентам',
        'photos'      => array(
            'https://sun9-77.userapi.com/s/v1/ig2/T-36tKQfZWe8_n960dPTpvZqKMwIKFVtOVF5OCuU1AAaLVw_7rE5EHbl0-JnLTMxcOHqwamyw1hVkCNdgMWG17nF.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-75.userapi.com/s/v1/ig2/aBfJTV-re9KUf4de9RhPz3DwcDHe2U7oJlJF7Ejz191P9KWyXUcNjfPjTe-D7ZFIkDaPhDTQb5OIFkudtaKVtng1.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-32.userapi.com/s/v1/ig2/z45JcvgM4qU73SZaaWEFyFK89NHFNBHem6v78YQZG4uOzsQ88KET8Xx2AsiF2WSYFWp3NjHypKm2UyXnJjRYnAiI.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-11.userapi.com/s/v1/ig2/Wru0t4k8y2AaCsBU5_-s5xtbaqAXICobx-4bLHzn-rK3YXTjC8ssrGYfrWgVg-CFhE41BiCtLv_IolBAd2avovN0.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-56.userapi.com/s/v1/ig2/wZFtGgNvybtxrOuGxt2psB951OsJQSCPw97BiYgUpJHpXpNMqOdZH8By5HZArNATMxe2UzPu53mjmj-zVfuAwfdR.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262531,
        'title'       => 'Кухня Бирма',
        'price'       => 265000,
        'description' => '✅ Кухонный гарнитур «Бирма»: Уголок для гурманов и практиков 🌲🖤  

Представьте угловую кухню, где глубина тёмного дерева сочетается со светлыми оттенками фасадов, а каждая зона работает на ваш комфорт. Именно такой проект мы сделали для семьи Марины и Игоря, которые хотели совместить функциональност',
        'photos'      => array(
            'https://sun9-33.userapi.com/s/v1/ig2/Xtsd8WyX6ytLEiGeiGFiAma5KHcVe0g64XHNtFU2EHikq-M4WuaPdZx8hzRptpPO5MO-z17IcWqFU4PtOEt2kVnC.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-82.userapi.com/s/v1/ig2/ErXiPB-6qLfubi3kkr7jq9ZrF4-UpmrWF2iQgpKAd798Z5qTd8WKedfhiuP59oovTO5Mbo6FxECZdqKrC_vFRzHD.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-24.userapi.com/s/v1/ig2/NFrK7TRQFRDWGQu7Or8bDF6O1wpx2HDTsyOEAPBQr1ygdrXK-C-_E3mlz7DRdyioobjnhiiYRYeeUMt5OAhgiPXj.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-71.userapi.com/s/v1/ig2/nfNgpXjV6-mUUTgSbwUh7bCsiM458WMWl88DRqc10vqYQcRUZSG9nBZhCP-n89SnKcUC-qA3NNMW_8lbnKk493Dx.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-36.userapi.com/s/v1/ig2/mrEg9PMBERuePmIZ2nRXI6VTqZIgb5IA2mpOQoONRvhHs4gXuut56AIkMzR7mkNV42MQ1VRssZEIskogywTK1b7u.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262463,
        'title'       => 'Кухня Светлый бриз',
        'price'       => 276000,
        'description' => '✅ Кухонный гарнитур «Светлый бриз»: Простор и функциональность в каждом сантиметре 🌾🖤  

Представьте угловую кухню, где светло-бежевые фасады создают ощущение воздушности, а продуманная планировка делает даже компактное пространство удобным. Именно такой проект мы реализовали для семьи Ольги и Серге',
        'photos'      => array(
            'https://sun9-48.userapi.com/s/v1/ig2/EgD459KPxnFANlDYnHPRmcaYC3HsSXWWiGcY9lj9D6-aa1_8ogdJNQ6wuganH5gPU4Ubz7LmwDIC_vWEvM6tRKQC.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-76.userapi.com/s/v1/ig2/1otQpPJjpsklI_qCY_mLz8mppONV0GQLoUKiKMJeFVwT8HgqElzIP-gEBm0iCljQ9d_uQhdoI_BiIU4C6RWtrJ77.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x271,480x361,540x406,640x481,720x541,1080x812&from=bu&cs=1080x0',
            'https://sun9-60.userapi.com/s/v1/ig2/d3AjPe4FobOatNiGGT-ynI62y3t_mHFPY4Lc9Mlt7W4Ak5JNVp3tYV8vZd63H0gFTI9cG6x47z2-BWcR6W29MMLh.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x481,720x541,1080x811&from=bu&cs=1080x0',
            'https://sun9-72.userapi.com/s/v1/ig2/2ZTsJBPWkrCrmQ3u2K24vVJfDNr98uCTxaut_XKcyQPdYX9NCpkKwg8bB03YLB5Jv57xHxZDL_1yI_CSBflvaurf.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x481,720x541,1080x811&from=bu&cs=1080x0',
            'https://sun9-12.userapi.com/s/v1/ig2/7TtqaUXcKnRE9Q12e5lZVWQ-rk-LGBPrDG1a2FsIRqTOIAgDTvhFMiyuJwJIJWwMBhAzqGFqk_BnstOnv3S3vXoq.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x481,720x541,1080x811&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262423,
        'title'       => 'Кухня Сармано',
        'price'       => 187000,
        'description' => '✅ Кухонный гарнитур «Сармано»: Глянец, свет и функциональность ✨🖤  

Представьте угловую кухню, где глянцевые фасады отражают свет, создавая иллюзию простора, а каждый элемент продуман до мелочей. Именно такой проект мы создали для Максима — дизайнера, который хотел превратить маленькую кухню в совр',
        'photos'      => array(
            'https://sun9-30.userapi.com/s/v1/ig2/lGI39BN6fzOvxrCHP4OjQlZh6wc-pSJXzud8vpSSUHprenJAGClMHOqktNC-1-6q_RX1gldkJGq-0WwtcEifATno.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-72.userapi.com/s/v1/ig2/bR24pAZLoaVOAw_E1DV1vYuYraGRSVebxmAo7cJma6UyKoX_zfJj2AT_lczb8qc9YEcJHXuvY7z6RbtdzXsTXNCu.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-50.userapi.com/s/v1/ig2/CLOEj6uP6CZqM9WiDLs8aV-gz5er594naybbeKXWqR0i7G809eIdXhQvca0V3qvkuUdEwKTyBzwxRw5VwYbz9YX9.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-58.userapi.com/s/v1/ig2/W0VTL9gzeDpZFhs49Y0itVfoFTVrcAAXYa2hkCGCWSO00r8PgTaTFBPk0TAvFcBq7ueleU_mYiLt9WQSDGZPz2cM.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-50.userapi.com/s/v1/ig2/cIZPsCEDdL5on3IieXgbNWq7zoiXySTNIi2BNRo9fIr3GjldYlSkft8YpFQtbAu5OA8dLaDpynPU4rs_i_pkG5FV.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262414,
        'title'       => 'Кухня Фрида',
        'price'       => 175000,
        'description' => '✅ Кухонный гарнитур «Фрида»: Бюджетно, уютно, практично 🌿✨  

Представьте компактную кухню, где светлые тона визуально расширяют пространство, а натуральные текстуры создают домашний уют. Именно такой проект мы реализовали для молодой семьи Анны и Дениса, которые искали функциональное решение для св',
        'photos'      => array(
            'https://sun9-66.userapi.com/s/v1/ig2/bMzk_Bd1o4FWw5cCakHfK2m2Oed0owXh0H_Hu1GtKDrLKeQAZA3FLv8jWxRWuKqYBFtrZKFwZHVGsqVqACIoPRSy.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-40.userapi.com/s/v1/ig2/4-K9ru1a6ct3M1SFplWHWRrqbOG6znvq4m_yO2FxaY3wq2eSaaBUd03jP0RCPzGDAVguau8Syat7KnP1jyYBsIeU.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-52.userapi.com/s/v1/ig2/-srW4pHADH38voGzmjy6Ayo-6U4ScwTl15_ZIJjwkLm3bk5pjU1i46qm1TwFxqA86aT-k4az8PUmICJrEoI_VMle.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-29.userapi.com/s/v1/ig2/qcngkEps0MKnIKW31IDvRBtdg7nF2HcKE2FVlWZH8Fr28kGf8hBnEfVvzcmcmzRJpJz_Z60LEGXuWebq5ShKSEuR.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-70.userapi.com/s/v1/ig2/kd6_sdcKPJYfgsHCxsongo0iL3o6953JOZeedStb4k_y8Aneo0_HGEdeuCL1OrC_xIULZbf2tActPA16mgvq9pWl.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262407,
        'title'       => 'Кухня Мокко',
        'price'       => 318000,
        'description' => '✅ Кухонный гарнитур «Мокко»: Бюджетно, стильно, функционально ☕️⚡️  

Представьте угловую кухню, где светлые тона создают ощущение простора, а кофейные акценты добавляют уют. Именно такой проект мы реализовали для Виктории — студентки, которая искала практичное решение для своей первой кухни без пер',
        'photos'      => array(
            'https://sun9-7.userapi.com/s/v1/ig2/nKxZK8tnUnKTIXEAShu6S_lKZrsUN9M2mthteqqxQe7W695faeuspz9mmQoNaGd0J08qE7wh1U1_4gg3q-ZiCxvC.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-67.userapi.com/s/v1/ig2/9zrLosvK58k8bOW9NPEaTsaX1fJ1jPBSyNXPkjDUnE9NOoEzKL4ll5BvITCC4Rhi3bV6LIxtalNCJYzlo3d9KDXK.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-71.userapi.com/s/v1/ig2/jNMktC_LjE-_T7Ot18c5-xRExExGXfBWdnrHshyXg3lzO6TEacBU59vGUdjYZYlUhqnzPdB4mbP17inLWso6cvmI.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-68.userapi.com/s/v1/ig2/E84jasZEZbAqIw0TOTiCPf4VxwHLoV2ZpAv8YbneMSk844FKsoj0brWqYH2bslClsKHHQcyGzRzjOHBcvDI45Q2y.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-11.userapi.com/s/v1/ig2/un6uoJsF2grx4kfyPxohbak18wRJtzEnouH3opp34a69cDAk1YqFkmCe_dVd9fPCirO9d39V9Gjrb9961WmsrgqW.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262398,
        'title'       => 'Кухня Элеганс',
        'price'       => 267000,
        'description' => '✅ Кухонный гарнитур «Серый Элеганс»: Удобство в каждой детали 🌫️🌿  

Представьте угловую кухню, где каждый сантиметр продуман для комфорта, а серые тона создают атмосферу спокойствия. Именно такой проект мы реализовали для семьи Дмитрия и Екатерины, которые мечтали о функциональном пространстве без ',
        'photos'      => array(
            'https://sun9-53.userapi.com/s/v1/ig2/2p0Re2nhyjiH-sih6wYPTLt1YeBBnvCWr_2Y3c0EcyWwfDytiXS6ld-19VpGqsspwZ5GeelaLwFILcASwXG1JiM0.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-49.userapi.com/s/v1/ig2/Ym-UZg8lt-DFq1FtEwo0Thp3dcIBpha3k1QA7rEjSAK-gajkSrup5JFXxdcx7XuGT9Gz9ggvnE0X9SQ35n4mllm1.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-45.userapi.com/s/v1/ig2/9FBAa8Nb9Tzf5PoMLJV6RtAqfOVlE6xjP0GXofkR56oVFrf6GT7yeAxHN0WwQdGMXaAYcLNXIswqZyeewQuqbCbT.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-76.userapi.com/s/v1/ig2/TuO3Kbkmm99_zPJF1UkPMZgLyRkIEAiSN7WJe0tmeUj1rGJCyOqEIW1LvPZetMbJ14EF1phOFY-rHqQ5y3SM-Va3.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-28.userapi.com/s/v1/ig2/8Q4XocSh8pFMRYnulKQ0EX92QdxaZeZGh6mrPVkWmv0XLsGi5HVqnSoFv5JrmIvVcVDPPs-hO1ISj2tU2FkknEMl.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262347,
        'title'       => 'Кухня Контраст',
        'price'       => 298000,
        'description' => '✅ Кухонный гарнитур «Контраст»: Графит, белый глянец и тепло дерева ⚫️🌳  

Представьте угловую кухню, где холодный графит встречается с теплом натурального дерева, а глянцевые фасады добавляют ноту современности. Именно такой проект мы создали для Анны и Игоря — пары, которая хотела сочетать индустр',
        'photos'      => array(
            'https://sun9-19.userapi.com/s/v1/ig2/IdfSJDh41nTkGIq5E1Zvos27j6nCmNfQ_CWxwJ1vk--pd5vDQwTEiZ73lDVyMbT8bAIXaG7UbbTV4iUKn2xaKRyR.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-60.userapi.com/s/v1/ig2/oIqdnTtQsbuPL_CUtJSoNJk0KW8-Ex653RzG46FVU_v0gRFKzBJA7siwmxrGUxTs3NGAaCr_p4-7KU7umVS_o98M.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-5.userapi.com/s/v1/ig2/-5ibGKXwE000bk1NjumM9MG0I5eojdErIwSMrb4DYi6130EU9ooTs5vAbJ9Uy02gLEGriLUs6W06M0WAXZD-c2wq.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-78.userapi.com/s/v1/ig2/munP6HbMBwThk-m3Uw8WQeojqrEbTeRwE_xFwgOqPHvPED7SMtrQ4B6i8gDNuw-skW7sTLc7mLl-zj-5SbvC9lVN.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-57.userapi.com/s/v1/ig2/8gaoMoaPYDZlHygAfX5JOISpQatm9m3dzyvObcWpYs4ulyC4JQaCBNG3IE3Z9UJ6Y-MQ8lHhNS43cxDsoHQkwDob.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262037,
        'title'       => 'Кухня Ампир',
        'price'       => 390000,
        'description' => '✅ Кухонный гарнитур «Ампир»: Неоклассика, где роскошь встречает функциональность ⚜️✨  

Представьте кухню, где белоснежные фасады гармонируют с теплом античной меди, а каждый элемент будто сошёл со старинного полотна. Именно такой проект мы создали для семьи Марины и Андрея, которые мечтали о простр',
        'photos'      => array(
            'https://sun9-66.userapi.com/s/v1/ig2/t0T3bZZo-t4NSTYbnrU_yE5dUfIiQi8rvWgYFFq4a8-rjkVzholsgjPUi-9ZjElrknkmV0wV_g6VxJVxmNq7iNic.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-31.userapi.com/s/v1/ig2/xaWMkw4v38LC_ROWqCYjEAJkZnDft_jTceAVTrG1euW35HTU2urqJCu2Te7WTlmdVTTLeH7KFT1JZ4HnxfoyQBZJ.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-3.userapi.com/s/v1/ig2/ggYiJCIxtmqy9_qnaZNPoW6D1C-XwXj4aHB83SqJCXrE1LfLGRKVSRYleaGtxOlML00nKmHOZZcOZxVT1mnIsfa0.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-40.userapi.com/s/v1/ig2/iF-QpvNQHnweNoiOPL5ddB8itHqZNbv7oES-1ZKoGT_bh51VgFZ8C5w7cWPIKhy4AuuzQMPZ6SSiPHmGj8SRF-q8.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-14.userapi.com/s/v1/ig2/ZaowmOepM1r70VtBqiHs-n9HyONWIFheylLHFg-V1TTwFznE_jcaMyxeU0hw3gX7hMjznrE6J73R3rqk_l52JzBa.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262316,
        'title'       => 'Кухня Гранит',
        'price'       => 238000,
        'description' => '✅ Кухонный гарнитур «Гранит»: Минимализм с индустриальным шармом ⚫🏭  

Представьте угловую кухню, где серые матовые фасады сочетаются с фактурой тёмного камня, а каждая деталь работает на функциональность. Именно такой проект мы создали для Артёма и Софии — пары, которая ценит лаконичность и техноло',
        'photos'      => array(
            'https://sun9-62.userapi.com/s/v1/ig2/XEFG7KrUZygn92Q4OA-r81sMy5rJoeKIo3hInd4jIWgLMyrTBiE2cqt4albYTo8bDpkiK08iWifQ8LJ__-qnOTX7.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-71.userapi.com/s/v1/ig2/UtG8D0yq1mUUPGfJLjAEAe5SLJ3zR4kiWbmCdywcvS7aIYhPI4oQx5xZdIiQlRmSi0eBFXNfhPjR9dZfCqe9qXWJ.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-12.userapi.com/s/v1/ig2/aedFWVjEb8YbBaZpillBEUSMpBtZBCyDDpnOd8_Bfpe59dWvezgMtmdzoSTWl6-JTri8PKzl3Qml3mMxCtC-VlXp.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-12.userapi.com/s/v1/ig2/lOdk7E-aYyG46FOAkU16mCJVJCVEbo4XDuhGSrXxnL5Ox3t60VTvFZmIe8lGyZ7M8COLry9fcx99Z8UBhb_9we_h.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-78.userapi.com/s/v1/ig2/HHpghBpVqzFoSd-r2U3ZIq2GNrPOVoTpc1VGG-CHgPuP9ISPdSQe8Eu7T0Kf6JyO3YDKQM931tdnru6RmJI_MFPH.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262296,
        'title'       => 'Кухня Компакт',
        'price'       => 186000,
        'description' => '✅ Кухонный гарнитур «Компакт»: 6 м², где есть всё 🌳📺  

Представьте угловую кухню, которая на шести квадратных метрах уместила и функциональность, и стиль, и даже место для вечернего кино. Именно такой проект мы создали для Алексея и Кати — молодой пары, которая хотела превратить крошечное пространс',
        'photos'      => array(
            'https://sun9-53.userapi.com/s/v1/ig2/RNegBavvj6MBQKnsQvQb_3aqQoAYU_VGf6J0xqu3DvVr0J1Gf1eaGdw1WOQCt8o08DhQ-Tt0-V6wTAcJfd0Y4zqT.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-21.userapi.com/s/v1/ig2/2D7pPb3RXtChPD8azu3GfiSUUx_IFwz5SpQ4eGBCGvT6cgxGGeXk9WoMGIryiE82SVNfb2MS-yDh5vV_gFkTAF0J.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-87.userapi.com/s/v1/ig2/vAHT3y7gpF1PTh_l6uJwstAF-bdLr1h-uK1rc-iTmO5HOTsH6Pj9ZzjkXBiBvLjYlyeUaicvQCDX1tF4aheVAEhc.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-9.userapi.com/s/v1/ig2/OqtOLVP3q2T6VA37mppnJQKx85T6YcKqmSUzIaRQDTGOvQBdQEqDPT0CW3Gez0bcDLlaz4JQGQ6mIPSM5FRBU_hp.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-47.userapi.com/s/v1/ig2/MGDMcS_2pqe43KD9cDohY0iczb9eDZy9yCp_v9Mtl2WgF31Sb9cjZya-z9EKERqoaTnN3fpHB2euUC5iiYku3rmr.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262272,
        'title'       => 'Кухня Монохром',
        'price'       => 344000,
        'description' => '✅ Кухонный гарнитур «Монохром»: Контраст, который вдохновляет ⚫⚪  

Представьте угловую кухню, где белый матовый фон играет в дуэте с графитовыми акцентами, а подсветка добавляет магию даже в будничные вечера. Именно такой проект мы реализовали для Вадима и Ольги — пары, которая искала лаконичность,',
        'photos'      => array(
            'https://sun9-36.userapi.com/s/v1/ig2/twCFCd-yRD9o_JM7IWrqXt1uRjcLkflwA6OC3WgkWL7-v16fk_Qw9hhY6h79GlFm_lV1S1Gmw5mXRmove1huTPvJ.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-60.userapi.com/s/v1/ig2/lDEgTP_ygfxKnJgQDzluPZxtz9WFww36nL5jGcV5biZhVWKnGr1kykQetb9tB_NOKvutupYFarHjq6XFvGFG7SGm.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-27.userapi.com/s/v1/ig2/31VqIvFkSXVaDQZnonHcIwgsl6oKniiOlZr_vcmLAcOmFGs95whExy6fnKtkg0eoHuFiIc4PxRQT4Q8xlObSBhcK.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-59.userapi.com/s/v1/ig2/F45aqgZvHogPogk81ft-bRFTsw7GofdCVeuz2U78uatOJYPC-P8mbmUwDC5maTjppcCnzjLDA_j9L_z60BJda4SH.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-60.userapi.com/s/v1/ig2/NnXvGGtCWYpQMB0U3j6h0ItE69ISTx8tuQXAaLKH_ruBqLQ5G_ODOTfxSog_l9WvJZdqDYfke-NeB1COWrr8U45N.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11262082,
        'title'       => 'Кухня Эклиптика',
        'price'       => 407000,
        'description' => '✅ Кухонный гарнитур «Эклиптика»: Уголок элегантности с акцентом на детали 🖤✨  

Представьте угловую кухню, где матовые фасады переплетаются с фрезеровкой, а теплая подсветка создаёт уют даже в самом загруженном уголке. Именно такой проект мы создали для Алины и Максима — молодой пары, которая хотела',
        'photos'      => array(
            'https://sun9-50.userapi.com/s/v1/ig2/j3qRv_uvcjIkR7SR1is5JcOH4e3tduD4FOowdcuN6ShVG-4zCK-XKtYlMAJH_z5l6iVC4h4oWM7QVBnVtGYxjK2z.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-37.userapi.com/s/v1/ig2/4SvfcC9aa8lg8aKPIMaWGrgQ4SFFWUE0VnnAm5lmPiU2jwPBUNg5stNOgQHgLrNQ77l-40KQbQwnPeyxveVfgk-f.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-53.userapi.com/s/v1/ig2/OlgAaUgnaAyvb23lnOTLkEkG9nV-ugY2Sdvjv2NodLSdYCMvkTKvuNu-4oQONFM2nCYlHZ_U5cp24DrtKcN7I0AN.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-82.userapi.com/s/v1/ig2/Gm1g4dljgUOk48vBe_j52HH4e4EZ-O94O4RQvGd__oWnyR7sMAsKfZOidcqaMzm6gQjh5l9SUU6vOwyevGyryDkm.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-40.userapi.com/s/v1/ig2/v1p0j74d8sRubD0DdhQmUFBX122NwiOelYI-NhESRi_IpAYMnfoVBSfVjrkHFZJ3zdy05XXFkATX8rzZpHvWT8io.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11261985,
        'title'       => 'Кухня Валенса',
        'price'       => 429000,
        'description' => '✅ Кухонный гарнитур «Валенса»: Совершенство от пола до потолка 🌟🖤  

Представьте кухню, где каждая деталь — от каменной столешницы до подсветки — создает атмосферу современной роскоши. Именно такой проект мы реализовали для Дмитрия и Елены, которые мечтали о пространстве, объединяющем функциональнос',
        'photos'      => array(
            'https://sun9-74.userapi.com/s/v1/ig2/FIlQO-Nu2lGdMf-QH9PY91STx9g9XopWEtcnqJQFoK0FjfQEc8TLTCrmQaynQAnDqwCypkfDfHJeKt1y5moKKkwB.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-1.userapi.com/s/v1/ig2/oNgZ7EFnEQiFtj9xINEcoNOf9PPihU5qsYcCa8LgxWGi7irLOwESQomKe4USsF9Oyv4bomZKuFcl-nMlA-islm6l.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-58.userapi.com/s/v1/ig2/q9ptWln_bq6ecAPxCHXDFA8rzH6sIOs1HQOB5FF6ePUlbp73hae8GIHaG2SDQH-F9NHsICIf5TClgliNWmihEcHL.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-45.userapi.com/s/v1/ig2/Q347UyPHKvzFQeSL80qv97x9DrvGvSzDNtfZZdA5QXExxFcIZD1GH1SBz-exUPsTGQEd8l5L2UdZs4pwEy5CIPfg.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-62.userapi.com/s/v1/ig2/3r8QkG_qx8C8XDVC0etuhOCnurjzDib1-L-gCxnkFRsfb1PzpD-xoO_TMIx3CAkum2BcLDXW8rvS6pWsCrPBIEu9.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11261959,
        'title'       => 'Кухня Либеро',
        'price'       => 315000,
        'description' => '✅ Кухонный гарнитур «Либеро»: Пространство, где функциональность танцует с эстетикой 🖤⚡️  

Представьте П-образную кухню, которая объединяет зону готовки, барную стойку и умное хранение в одном месте. Именно такой проект мы реализовали для семьи Игоря и Алисы, которые хотели превратить кухню в сердц',
        'photos'      => array(
            'https://sun9-37.userapi.com/s/v1/ig2/vGPSy6Emryam-5q0PM9bCnGPdsfH0BwRVrZJAwPVuHMoPKYS5W-8awcjo4bnttEsY57FZd9_64kIYEQQ-At6tZNr.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-49.userapi.com/s/v1/ig2/g__ge3l0fA1VfkDqvFBY5POjXyRKlPUZdu-dpX5hs4BNVXcKDKRBFvhtmMpT1ODpWj3Iim1u33SOnZUupzMoDFcx.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-86.userapi.com/s/v1/ig2/psAIQ8JP-3TNycE6ncbaNpjsR0F5j2AVGTThG2CVzUTyOTs5XHtcoEhRJRUf0Vd1e0t_6G8MsJ8Oh323IK39gb0Q.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-22.userapi.com/s/v1/ig2/_65vzEUuRdhdqgeQLs_dU0TWhzTv4qugZUSzYmVInTpCZnctEaLsExISm6am90Oo6dJjPFW9Ti4vuVF1qIhyEien.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-26.userapi.com/s/v1/ig2/XaeZIkeR_xAn-PLJ3Xv-4pu463EslS1lIaoTobGj5QOXQb6ZiDc5oHarXVo9rXrF60FGDxGzL_usMY2e2XhtIiZG.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11261796,
        'title'       => 'Кухня Парма',
        'price'       => 187000,
        'description' => '✅Кухонный гарнитур «Парма»: Свет, стекло и безупречный ритм 🌟🖤  

Представьте кухню, где встроенная техника сливается с фасадами, а барная стойка у окна становится главным местом для утреннего кофе и вечерних встреч. Именно такую кухню мы создали для Виктории — дизайнера интерьеров, которая хотела п',
        'photos'      => array(
            'https://sun9-33.userapi.com/s/v1/ig2/sDY_OFSANyJYRWENCBpV2WIDIiGW2Gcb7EgGyKX0UhLhHI0yTW_GLvPc3z6DcmEi4HkVLIon8pjFMZ4xR71f9P3q.jpg?quality=95&as=32x40,48x60,72x89,108x134,160x199,240x298,360x448,480x597,540x671,640x796,720x895,1024x1273&from=bu&cs=1024x0',
            'https://sun9-51.userapi.com/s/v1/ig2/qklG7CUAacFdDhZHoD5xVZAlZBePG491lOQ03yDLETbGTrTVTgIj7P6XWpdS29DOfLdmsVh3im8qf2rLCkqg59Se.jpg?quality=95&as=32x40,48x60,72x89,108x134,160x199,240x298,360x448,480x597,540x671,640x796,720x895,1024x1273&from=bu&cs=1024x0',
            'https://sun9-53.userapi.com/s/v1/ig2/MIWLStjEU2P33WUz7kWUADJyeup7c0ffXEIel4dRw-G4I3zzgD4pgOH4mNypnAGPqARwssFn6m-_vdb2gG1Rc5M6.jpg?quality=95&as=32x40,48x60,72x89,108x134,160x199,240x298,360x448,480x597,540x671,640x796,720x895,1024x1273&from=bu&cs=1024x0',
            'https://sun9-61.userapi.com/s/v1/ig2/zo51LFrBV-One2jgPf7ZMyH_Z2qgWw9iFbOoFWCNfQd4JwOjjGT_eROQf23vAzIbauhfIkPyWa_sEyVxkRjFjsdx.jpg?quality=95&as=32x40,48x60,72x89,108x134,160x199,240x298,360x448,480x597,540x671,640x796,720x895,1024x1273&from=bu&cs=1024x0',
            'https://sun9-53.userapi.com/s/v1/ig2/okl7tkA4hZDMrn9NKjaMjONt4OmpXsF0_w_g4aKiKJo-MV8uufgWznlI1qnNWf9K-QkOobGu3K13X-eRnpNp_D63.jpg?quality=95&as=32x40,48x60,72x89,108x134,160x199,240x298,360x448,480x597,540x671,640x796,720x895,1024x1273&from=bu&cs=1024x0'
        ),
    ),
    array(
        'product_id'  => 11261744,
        'title'       => 'Кухня Порто',
        'price'       => 312000,
        'description' => 'Кухонный гарнитур «Порто»: Свет, стекло и безупречный ритм 🌟🖤  

Представьте кухню, где встроенная техника сливается с фасадами, а барная стойка у окна становится главным местом для утреннего кофе и вечерних встреч. Именно такую кухню мы создали для Виктории — дизайнера интерьеров, которая хотела пр',
        'photos'      => array(
            'https://sun9-36.userapi.com/s/v1/ig2/IawTYOC5uBN9yzo9FlQFERsl9dDIkTYQDXy458dcKtBhbaqsFrypZHal6VPH3uIHJbAgOal5rlnxEr4Efbhypiu4.jpg?quality=95&as=32x40,48x59,72x89,108x134,160x198,240x297,360x445,480x594,540x668,640x792,720x891,1080x1336&from=bu&cs=1080x0',
            'https://sun9-73.userapi.com/s/v1/ig2/TyAxLfw9lz0As68yZP_lnEx3oEbAzbxaio4uTTOdG12oawnoYsMofOrahtRMHpGLql1WdMDUEsLHnepC9Q3dWfVs.jpg?quality=95&as=32x40,48x59,72x89,108x134,160x198,240x297,360x445,480x594,540x668,640x792,720x891,1080x1336&from=bu&cs=1080x0',
            'https://sun9-65.userapi.com/s/v1/ig2/GUzdhft-N3WB7qllzxtDqUfwUQf8qn98lVDPgrDZFK6349cjBVwvQ347wwR0zJzpW2JgT9i-RJHMx-fjV8igZdTJ.jpg?quality=95&as=32x40,48x59,72x89,108x133,160x198,240x296,360x445,480x593,540x667,640x791,720x889,1080x1334&from=bu&cs=1080x0',
            'https://sun9-10.userapi.com/s/v1/ig2/4s3TAIU_PsWwy7YBB8xn6hxDTuQSnzcCJzYlqFBx4gVUTFWZz-Yjy7ya7dhKOuo7E2pCKVEV7-MxJKp5ansazoGh.jpg?quality=95&as=32x40,48x59,72x89,108x133,160x198,240x296,360x445,480x593,540x667,640x791,720x889,1080x1334&from=bu&cs=1080x0',
            'https://sun9-10.userapi.com/s/v1/ig2/L0WB9MkvCjoElFonHPIBlTpGsTD37G47JLiSOJ0hA-8AszAYxhujotEKb7TTY2TVkeAnTDKI2vBnLD9m8fQHgtXh.jpg?quality=95&as=32x40,48x59,72x89,108x134,160x198,240x297,360x445,480x594,540x668,640x792,720x891,1080x1336&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 11261310,
        'title'       => 'Кухня Самери',
        'price'       => 251000,
        'description' => '✅Кухонный гарнитур «Самери»: Белый фон, золотые акценты — роскошь в каждом сантиметре ⚪️🌟  

Представьте кухню, где белоснежные фасады переливаются теплом золота, а встроенная техника становится частью дизайна. Именно такую кухню мы создали для Алины и Максима — молодой пары, которая хотела преврати',
        'photos'      => array(
            'https://sun9-87.userapi.com/s/v1/ig2/TFuRCp_M7qkjPwdeb-GY8wx23cmWwqiRKkN02memvKLmLAl4Zy_Q2-6CWpUBQM76k2TY0ezczvmYyMBgsPKtIOzs.jpg?quality=95&as=32x39,48x58,72x87,108x131,160x194,240x290,360x436,480x581,540x653,640x775,720x871,1080x1307&from=bu&cs=1080x0',
            'https://sun9-3.userapi.com/s/v1/ig2/JCQDujkebvHSeTpJ-uFy9VLEeYeWEPgrRAx0dfTT-Ulk0bMVF73307y58hC0Utz8xrqaY2N4YHXwGV_LjO6jymyn.jpg?quality=95&as=32x39,48x58,72x87,108x131,160x194,240x290,360x436,480x581,540x653,640x775,720x871,1080x1307&from=bu&cs=1080x0',
            'https://sun9-51.userapi.com/s/v1/ig2/NA28qnG_YAXUfl7EcjDq3lZ7zGhOv043tMAnVPKOYDq96aRgbt6ierMR7YKsLme7log1g9g8oMuIUNmTKr8Hzckj.jpg?quality=95&as=32x39,48x58,72x87,108x131,160x194,240x290,360x436,480x581,540x653,640x775,720x871,1080x1307&from=bu&cs=1080x0',
            'https://sun9-84.userapi.com/s/v1/ig2/au21RRa-mAaVqxRtgyi3wusssGY4srKRShE-WK95v_qsv0qOWc0bv-SExLTJEsUr_ASIsBjeyYg-2oapdPUIFEYl.jpg?quality=95&as=32x39,48x58,72x87,108x131,160x194,240x290,360x436,480x581,540x653,640x775,720x871,1080x1307&from=bu&cs=1080x0',
            'https://sun9-87.userapi.com/s/v1/ig2/HjlIXDcHMVU4MiQbGyc0cc6xowC69ktCrCTQowf2Eh_WZqmKSEhwqZVKSiZqglYdFVd2rBtwDVZg_YXBvuo6mL3j.jpg?quality=95&as=32x39,48x58,72x87,108x131,160x194,240x290,360x436,480x581,540x653,640x775,720x871,1080x1307&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 951801,
        'title'       => 'Кухня Шторм',
        'price'       => 261000,
        'description' => '✅Представьте кухню, где каждая деталь продумана до мелочей. Где стиль встречается с функциональностью, а технологии делают быт легче. Именно так создавался гарнитур «Шторм» — для тех, кто, как и наш клиент Алексей, мечтал о пространстве без компромиссов.  
➤ Хотите так же? Напишите нам ВКонтакте  ht',
        'photos'      => array(
            'https://sun9-78.userapi.com/s/v1/ig2/f8SXWsAnkosDOuCHVRURKT50MGATXoZNx0kRU1UekZq1c2C6aHn7acbjWyQ40xNuG60nUmTr8a4UQjvImpkrq73y.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-18.userapi.com/s/v1/ig2/kmsjvL3fJFlJO6QXIc0IijF_a0gJujPU1o8EDepzqLy5PRGcBuHgjQF2HBY9t3eXHZbnjpb4iJxuA3iUwnI5GokZ.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-12.userapi.com/s/v1/ig2/sUxhT61Pjmx1ZlVeTCsm8rHQilEUyaA0JRwSpY83k-fT0LC93_U6MkqvoA731mjUvtD8ftgscgfxybn0xM3qWOns.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-50.userapi.com/s/v1/ig2/LdPUUUlQL0VfoJdClLo-dJ_O-UhudDDwJLOWFhHp06dR7NITFDBN81CtBDzNil-Qs8QQ6QoRFF7XfsF0Wnizqr5W.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-22.userapi.com/s/v1/ig2/O2DcV_pxaT0azBXtluosuUYuDtpXTSjpc__wX-L4kVt7diOoCKiNQRua6Qtex6nJDAU7ZtYjCYyo6LR_pSZVbjg2.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 2355138,
        'title'       => 'Кухня Эклипс',
        'price'       => 198000,
        'description' => '✅Кухонный гарнитур «Эклипс»: Теплота дерева и современный минимализм  

Представьте кухню, где мягкие бежевые тона сочетаются с фактурой натурального дерева, а акценты добавляют стиля и функциональности. Гарнитур «Эклипс» — для тех, кто ценит уют, но не готов жертвовать технологиями.  

Что в основе',
        'photos'      => array(
            'https://sun9-65.userapi.com/s/v1/ig2/ct9vcLI87svx0rKJeGI2G8FO8Y4HKzZf7FJEEEGNk-XNaGLqJRSsEgsaz8qwpBNglSuPLKjZusJtJVuva0qjcPQ_.jpg?quality=95&as=32x32,48x48,72x73,108x109,160x161,240x242,360x363,480x484,540x544,640x645,720x726,1080x1089&from=bu&cs=1080x0',
            'https://sun9-20.userapi.com/s/v1/ig2/Wfw3IbzKzNxmqOxCpNStTEp9Zgl86B95TXvNwknzSi3tQypDxrS-6ATNKgkvD4SuhPAHnD7-w6yjHZYyKgSaGdw1.jpg?quality=95&as=32x32,48x48,72x73,108x109,160x161,240x242,360x363,480x484,540x544,640x645,720x725,1065x1073&from=bu&cs=1065x0',
            'https://sun9-77.userapi.com/s/v1/ig2/QvNmsnbcvN7Fov_q8myc_33m1UrCBWjeK5stjh7YREyUpQqBGEocf4ha3lQpwBc5nxEIGV01t9Tbnq5xA9zyjLmC.jpg?quality=95&as=32x32,48x48,72x73,108x109,160x161,240x242,360x363,480x484,540x544,640x645,720x725,1061x1069&from=bu&cs=1061x0'
        ),
    ),
    array(
        'product_id'  => 2355140,
        'title'       => 'Кухня Терра',
        'price'       => 274000,
        'description' => '✅Кухонный гарнитур «Терра»: Где готовка встречается с отдыхом 🍳🛋️  

Представьте пространство, где кухня плавно перетекает в гостиную, а обеденная зона превращается в место для вечерних посиделок. Именно такую кухню-гостиную мы создали для нашей клиентки Анны, которая мечтала о функциональности без ',
        'photos'      => array(
            'https://sun9-83.userapi.com/s/v1/ig2/H2nTKSjKdUv1_usWwTVweJf5xWXF5vs8qRisQQpchiQ6_reaTYpb9Mod3ka89mtwUqIdyVe4iYm_T86-AhScSd12.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-32.userapi.com/s/v1/ig2/9JkwYxj0qnOAJGVg5n0GcKe-5wor_5mbzFrRaeGS7z5pSZY_udKxuJZIQGJnxUNNkGkSkyxebuZv4987ErR-Inqi.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-44.userapi.com/s/v1/ig2/rR7hS7B3PhqgWV6WLevgg7yJqn8F0GOj8OPwuU7KnbQX_vA1OvhbSiu187L7lvBRT1qNkzuknrFzF6KroYJGXsT0.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-17.userapi.com/s/v1/ig2/fh3Ujv-9Lrkqxa13osd6V1FYcuICrSr0WttHlaDV6EHxtN3Pph5PK_VK-IMwSC2ZytpX0MLBu-64KAtuabmV9QMt.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-83.userapi.com/s/v1/ig2/rBNo5hysCLXXnYd0XcC_qtU5Ousj3J6eUBCmFQwMauifGIeFAUR0xfixtpMhM5xWsG_JhbJLSJ0JtF_-wz7v1n5R.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 2405039,
        'title'       => 'Кухня Лиция',
        'price'       => 248000,
        'description' => '✅Кухонный гарнитур «Лиция»: Маленькая кухня — большие возможности! 🏠✨  

Представьте, как в небольшом помещении уместились остров, встроенная техника и стильный дизайн. Именно такую кухню мы создали для Татьяны, которая считала, что в её 8 м² невозможно разместить всё необходимое.  

История Татьяны',
        'photos'      => array(
            'https://sun9-65.userapi.com/s/v1/ig2/8ZC4R2sDpqB5Xsjy8HRJJRZcvD9FNC1j9-EbsUBAkgAcrpeX4sYu4Wd7EuGsZ-qkbVlkOYHpKFqv1O4gloDY5geE.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-65.userapi.com/s/v1/ig2/0d8gYQiJgIQk2D72izweuJWNDqPPHg2XvBik2_pS5_-bm3dPVnDmr2UHnCDy-lrQ7nxM9Q2y2SlsUtpqo4isA-oC.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-49.userapi.com/s/v1/ig2/e8qk9LTX_uA1LuiANruyYcNmhrjcGiVdkzZcFh3M6KI26k2DgYV1pQeEEeEEz-wa1WFSXnmHO6PCJsPpOfpf-N7c.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-32.userapi.com/s/v1/ig2/j7Bmg5SjulpxLC7z0vxJJj_P3eS9dP2pb7YMmHKMtpq6RD1CCmc1JceUhNaUrNBfcbIhdSgBVhuW-fzhNB_LCUYC.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 2355153,
        'title'       => 'Кухня Ньютон',
        'price'       => 224000,
        'description' => '✅Кухонный гарнитур «Ньютон»: Уголок будущего в вашей кухне 🖤🌀  

Представьте кухню, где даже в ограниченном пространстве есть место для стиля и умных решений. Именно такую кухню мы создали для Сергея, который мечтал о современном дизайне без компромиссов в функциональности.  

История Сергея: 💬  
«Н',
        'photos'      => array(
            'https://sun9-70.userapi.com/s/v1/ig2/7wSUmrbAg1gQiF_ZMXT5y5eWnHxG7f2q1FKbtfNc1iIB4k-u2WKrI_Nmuh5YH-QjDm_ODaGnidwft4xFNMcy3Ecg.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-82.userapi.com/s/v1/ig2/3ahoS2nNPh14b22usDo7UTI-G6yJ7NPNgD8jz2RgHdtVa56loQvPuQsDqxZyQ4btZRuyXKXGui_t4f2YDhvYexIE.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-79.userapi.com/s/v1/ig2/Bm2zECu3gzvrLlFls8uxZ5E6JQ0VjLc25IAhoPs1bkYNGa5AKq_lLJXutuDUi2OScgDr0usNF_iPz1HvMVjFd9Iu.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-22.userapi.com/s/v1/ig2/fnNGD2WfxBu2e3dFV0ZjQ9pYykS3vzAQ8BB3LrfXpBN6SmxrDMDSsCK27aHkrINxS1vGYIQPShXs9erOrrboxX4I.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-3.userapi.com/s/v1/ig2/fbsB6wJM9D6HSlC9ddrm3AhFEEPXxf9-vH7FyLLmwtJ8yRFlLiVSyciJQXCBEOz0yMMFG5rSyzsAzCkvcx1AnWvl.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'product_id'  => 2355154,
        'title'       => 'Кухня Пуэрто',
        'price'       => 299000,
        'description' => '✅Кухонный гарнитур «Пуэрто»: Практичность, доведённая до совершенства 🖤🔝  

Представьте кухню, где каждая деталь работает на вас: ничего лишнего, только функциональность и стиль. Именно такую кухню мы сделали для Марины — молодой мамы, которая устала от вечных пятен на столешнице и хлопающих дверок.',
        'photos'      => array(
            'https://sun9-55.userapi.com/s/v1/ig2/fU1dcsked6RNu4GOXxpt_d9NU8MrsgJ5YxHMb9jBN6PZ9Rce2h5VqpkwdZNtJwwPpzOE7GK5Oyo72d2I2zTafa_-.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-20.userapi.com/s/v1/ig2/vFodGFpBed44Ygr3Pu3ek43oIlb9D9fdfIOT7UX-hkEvSpH62LK9FdD5fAVfS2sy1P5LUYH_OHrBmfe4vBmqxXey.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-26.userapi.com/s/v1/ig2/I6lATCJjaFPAC3Hp3HiWdJFX8OuuKysCFwPVYAjdDFhmpNjX7jJwiJsFGwfFaaWR_7oUM3L_hWPiHFM5-0NyY1C6.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-43.userapi.com/s/v1/ig2/MiuWQKzwzdRcScGKKnoSyGjLaYm0Feq4T8HGy1333dQp4A9MKIqs8YBsArAqk3GH7A-DLpyyUTa2qNOdeYb5zYjC.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-27.userapi.com/s/v1/ig2/45GMBNCOHIzyTsdNmxSursWycqkFNkGbbYBn4eld5oP3FdWwKL3VmyoJJBNf0BqwzcOllutEzHwLMb-NXsDCo2Qh.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    )
);

// ---------------------------------------------------------------------------
// Main import loop
// ---------------------------------------------------------------------------
$created  = 0;
$skipped  = 0;
$errors   = 0;
$total    = count( $kitchens );

WP_CLI::log( "Starting kitchen import: {$total} items" );
WP_CLI::log( str_repeat( '-', 60 ) );

foreach ( $kitchens as $index => $kitchen ) {
    $sort_order = $index + 1;
    $title      = $kitchen['title'];
    $price      = (int) $kitchen['price'];
    $raw_desc   = $kitchen['description'];
    $photos     = $kitchen['photos'];

    // Classification
    $kitchen_type     = classify_kitchen_type( $raw_desc );
    $kitchen_style    = classify_kitchen_style( $raw_desc );
    $kitchen_material = classify_kitchen_material( $raw_desc );
    $installment      = $price > 200000;
    $dimensions       = extract_dimensions( $raw_desc );
    $clean_desc       = clean_description( $raw_desc );

    // Check for duplicates by title
    $existing = get_posts( array(
        'post_type'   => 'kitchen',
        'title'       => $title,
        'post_status' => 'any',
        'numberposts' => 1,
    ) );

    if ( ! empty( $existing ) ) {
        WP_CLI::log( "[{$sort_order}/{$total}] SKIP (exists): {$title}" );
        $skipped++;
        continue;
    }

    // Dry run output
    if ( $dry_run ) {
        $photo_count = count( $photos );
        $inst_label  = $installment ? 'YES' : 'NO';
        WP_CLI::log( "[{$sort_order}/{$total}] WOULD CREATE: {$title}" );
        WP_CLI::log( "  Price:       {$price} rub" );
        WP_CLI::log( "  Type:        {$kitchen_type}" );
        WP_CLI::log( "  Style:       {$kitchen_style}" );
        WP_CLI::log( "  Material:    {$kitchen_material}" );
        WP_CLI::log( "  Installment: {$inst_label}" );
        WP_CLI::log( "  Dimensions:  " . ( $dimensions ?: '(not found)' ) );
        WP_CLI::log( "  Photos:      {$photo_count}" );
        WP_CLI::log( "  Description: " . mb_substr( $clean_desc, 0, 120, 'UTF-8' ) . '...' );
        WP_CLI::log( '' );
        $created++;
        continue;
    }

    // Create the post
    $post_id = wp_insert_post( array(
        'post_title'   => $title,
        'post_content' => '',
        'post_status'  => 'publish',
        'post_type'    => 'kitchen',
    ), true );

    if ( is_wp_error( $post_id ) ) {
        WP_CLI::warning( "[{$sort_order}/{$total}] ERROR creating: {$title} — " . $post_id->get_error_message() );
        $errors++;
        continue;
    }

    // ACF fields
    update_field( 'kitchen_price', $price, $post_id );
    update_field( 'kitchen_dimensions', $dimensions, $post_id );
    update_field( 'kitchen_description', $clean_desc, $post_id );
    update_field( 'kitchen_installment', $installment, $post_id );
    update_field( 'kitchen_sort_order', $sort_order, $post_id );

    // Sideload gallery images
    $gallery_ids = array();
    foreach ( $photos as $photo_url ) {
        $att_id = kitchen_sideload_image( $photo_url, $post_id, $title );
        if ( ! is_wp_error( $att_id ) ) {
            $gallery_ids[] = $att_id;
        }
    }
    // Set first image as featured
    if ( ! empty( $gallery_ids ) ) {
        set_post_thumbnail( $post_id, $gallery_ids[0] );
    }
    update_field( 'kitchen_gallery', $gallery_ids, $post_id );

    // Taxonomy terms
    wp_set_object_terms( $post_id, $kitchen_type, 'kitchen_type' );
    wp_set_object_terms( $post_id, $kitchen_style, 'kitchen_style' );
    wp_set_object_terms( $post_id, $kitchen_material, 'kitchen_material' );

    $created++;
    $photo_count = count( $gallery_ids );
    WP_CLI::success( "[{$sort_order}/{$total}] Created: {$title} (ID {$post_id}, {$photo_count} photos)" );
}

WP_CLI::log( str_repeat( '-', 60 ) );
$mode = $dry_run ? '(DRY RUN) ' : '';
WP_CLI::success( "{$mode}Import complete: {$created} created, {$skipped} skipped, {$errors} errors" );
