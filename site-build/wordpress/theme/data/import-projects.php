<?php
/**
 * WP-CLI Portfolio Projects Import Script
 *
 * Imports 12 portfolio projects from VK Market data (top kitchens by price)
 * into the WordPress CPT 'project'.
 * Source: site-analysis/vk-photos-index.json
 *
 * Usage:
 *   wp eval-file data/import-projects.php
 *   wp eval-file data/import-projects.php --dry-run
 */

if ( ! defined( 'ABSPATH' ) || ! class_exists( 'WP_CLI' ) ) {
    echo "This script must be run via WP-CLI: wp eval-file data/import-projects.php\n";
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
function project_sideload_image( $url, $post_id, $desc = '' ) {
    $clean_url = preg_replace( '/\?.*$/', '', $url );
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
// Helper: find a kitchen post by title (to link project → kitchen)
// ---------------------------------------------------------------------------
function find_kitchen_post_by_title( $title ) {
    $posts = get_posts( array(
        'post_type'   => 'kitchen',
        'title'       => $title,
        'post_status' => 'any',
        'numberposts' => 1,
    ) );
    return ! empty( $posts ) ? $posts[0]->ID : 0;
}

// ---------------------------------------------------------------------------
// Helper: clean description — remove emojis and VK-specific text
// ---------------------------------------------------------------------------
function project_clean_description( $desc ) {
    $desc = preg_replace( '/➤.*$/us', '', $desc );
    $desc = preg_replace( '/Хотите так же\?.*$/us', '', $desc );
    $desc = preg_replace( '/Напишите нам.*$/us', '', $desc );
    $desc = preg_replace( '/ht$/us', '', $desc );

    // Remove emojis
    $desc = preg_replace( '/[\x{1F600}-\x{1F64F}]/u', '', $desc );
    $desc = preg_replace( '/[\x{1F300}-\x{1F5FF}]/u', '', $desc );
    $desc = preg_replace( '/[\x{1F680}-\x{1F6FF}]/u', '', $desc );
    $desc = preg_replace( '/[\x{1F1E0}-\x{1F1FF}]/u', '', $desc );
    $desc = preg_replace( '/[\x{2600}-\x{26FF}]/u', '', $desc );
    $desc = preg_replace( '/[\x{2700}-\x{27BF}]/u', '', $desc );
    $desc = preg_replace( '/[\x{FE00}-\x{FE0F}]/u', '', $desc );
    $desc = preg_replace( '/[\x{1F900}-\x{1F9FF}]/u', '', $desc );
    $desc = preg_replace( '/[\x{200D}]/u', '', $desc );
    $desc = preg_replace( '/[✅⚪⚫⚜️☕️⚡️✨🌀🌾🌿🌊🖤🌟🔝💬🍳🛋️🏠🏙️🏗️📺📐🌳🌲🪵🗜️🍸🌑🌪️🌫️🌰⚙️🎶🌅]/u', '', $desc );

    $desc = preg_replace( '/\n{3,}/', "\n\n", $desc );
    $desc = trim( $desc );

    return $desc;
}

// ---------------------------------------------------------------------------
// Project data — top 12 kitchens by price from VK Market
// ---------------------------------------------------------------------------
$projects = array(
    array(
        'project_title'       => 'Проект Валенса',
        'kitchen_title'       => 'Кухня Валенса',
        'product_id'          => 11261985,
        'project_client_name' => 'Дмитрий и Елена',
        'project_area'        => '14 м²',
        'project_budget'      => '420 000 - 450 000 руб.',
        'project_duration'    => '35 дней',
        'kitchen_type_slug'   => 'pryamaya',
        'price'               => 429000,
        'description'         => '✅ Кухонный гарнитур «Валенса»: Совершенство от пола до потолка 🌟🖤  

Представьте кухню, где каждая деталь — от каменной столешницы до подсветки — создает атмосферу современной роскоши. Именно такой проект мы реализовали для Дмитрия и Елены, которые мечтали о пространстве, объединяющем функциональнос',
        'photos'              => array(
            'https://sun9-74.userapi.com/s/v1/ig2/FIlQO-Nu2lGdMf-QH9PY91STx9g9XopWEtcnqJQFoK0FjfQEc8TLTCrmQaynQAnDqwCypkfDfHJeKt1y5moKKkwB.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-1.userapi.com/s/v1/ig2/oNgZ7EFnEQiFtj9xINEcoNOf9PPihU5qsYcCa8LgxWGi7irLOwESQomKe4USsF9Oyv4bomZKuFcl-nMlA-islm6l.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-58.userapi.com/s/v1/ig2/q9ptWln_bq6ecAPxCHXDFA8rzH6sIOs1HQOB5FF6ePUlbp73hae8GIHaG2SDQH-F9NHsICIf5TClgliNWmihEcHL.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-45.userapi.com/s/v1/ig2/Q347UyPHKvzFQeSL80qv97x9DrvGvSzDNtfZZdA5QXExxFcIZD1GH1SBz-exUPsTGQEd8l5L2UdZs4pwEy5CIPfg.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-62.userapi.com/s/v1/ig2/3r8QkG_qx8C8XDVC0etuhOCnurjzDib1-L-gCxnkFRsfb1PzpD-xoO_TMIx3CAkum2BcLDXW8rvS6pWsCrPBIEu9.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'project_title'       => 'Проект Эклиптика',
        'kitchen_title'       => 'Кухня Эклиптика',
        'product_id'          => 11262082,
        'project_client_name' => 'Алина и Максим',
        'project_area'        => '14 м²',
        'project_budget'      => '400 000 - 430 000 руб.',
        'project_duration'    => '35 дней',
        'kitchen_type_slug'   => 'uglovaya',
        'price'               => 407000,
        'description'         => '✅ Кухонный гарнитур «Эклиптика»: Уголок элегантности с акцентом на детали 🖤✨  

Представьте угловую кухню, где матовые фасады переплетаются с фрезеровкой, а теплая подсветка создаёт уют даже в самом загруженном уголке. Именно такой проект мы создали для Алины и Максима — молодой пары, которая хотела',
        'photos'              => array(
            'https://sun9-50.userapi.com/s/v1/ig2/j3qRv_uvcjIkR7SR1is5JcOH4e3tduD4FOowdcuN6ShVG-4zCK-XKtYlMAJH_z5l6iVC4h4oWM7QVBnVtGYxjK2z.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-37.userapi.com/s/v1/ig2/4SvfcC9aa8lg8aKPIMaWGrgQ4SFFWUE0VnnAm5lmPiU2jwPBUNg5stNOgQHgLrNQ77l-40KQbQwnPeyxveVfgk-f.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-53.userapi.com/s/v1/ig2/OlgAaUgnaAyvb23lnOTLkEkG9nV-ugY2Sdvjv2NodLSdYCMvkTKvuNu-4oQONFM2nCYlHZ_U5cp24DrtKcN7I0AN.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-82.userapi.com/s/v1/ig2/Gm1g4dljgUOk48vBe_j52HH4e4EZ-O94O4RQvGd__oWnyR7sMAsKfZOidcqaMzm6gQjh5l9SUU6vOwyevGyryDkm.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-40.userapi.com/s/v1/ig2/v1p0j74d8sRubD0DdhQmUFBX122NwiOelYI-NhESRi_IpAYMnfoVBSfVjrkHFZJ3zdy05XXFkATX8rzZpHvWT8io.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'project_title'       => 'Проект Ампир',
        'kitchen_title'       => 'Кухня Ампир',
        'product_id'          => 11262037,
        'project_client_name' => 'Марина и Андрей',
        'project_area'        => '14 м²',
        'project_budget'      => '390 000 - 420 000 руб.',
        'project_duration'    => '35 дней',
        'kitchen_type_slug'   => 'pryamaya',
        'price'               => 390000,
        'description'         => '✅ Кухонный гарнитур «Ампир»: Неоклассика, где роскошь встречает функциональность ⚜️✨  

Представьте кухню, где белоснежные фасады гармонируют с теплом античной меди, а каждый элемент будто сошёл со старинного полотна. Именно такой проект мы создали для семьи Марины и Андрея, которые мечтали о простр',
        'photos'              => array(
            'https://sun9-66.userapi.com/s/v1/ig2/t0T3bZZo-t4NSTYbnrU_yE5dUfIiQi8rvWgYFFq4a8-rjkVzholsgjPUi-9ZjElrknkmV0wV_g6VxJVxmNq7iNic.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-31.userapi.com/s/v1/ig2/xaWMkw4v38LC_ROWqCYjEAJkZnDft_jTceAVTrG1euW35HTU2urqJCu2Te7WTlmdVTTLeH7KFT1JZ4HnxfoyQBZJ.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-3.userapi.com/s/v1/ig2/ggYiJCIxtmqy9_qnaZNPoW6D1C-XwXj4aHB83SqJCXrE1LfLGRKVSRYleaGtxOlML00nKmHOZZcOZxVT1mnIsfa0.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-40.userapi.com/s/v1/ig2/iF-QpvNQHnweNoiOPL5ddB8itHqZNbv7oES-1ZKoGT_bh51VgFZ8C5w7cWPIKhy4AuuzQMPZ6SSiPHmGj8SRF-q8.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-14.userapi.com/s/v1/ig2/ZaowmOepM1r70VtBqiHs-n9HyONWIFheylLHFg-V1TTwFznE_jcaMyxeU0hw3gX7hMjznrE6J73R3rqk_l52JzBa.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'project_title'       => 'Проект Флора',
        'kitchen_title'       => 'кухня Флора',
        'product_id'          => 11262699,
        'project_client_name' => 'Виктор и Алина',
        'project_area'        => '16 м²',
        'project_budget'      => '360 000 - 390 000 руб.',
        'project_duration'    => '28 дней',
        'kitchen_type_slug'   => 'pryamaya',
        'price'               => 366000,
        'description'         => '✅ Кухонный гарнитур «Флора»: Эргономика масштаба ⚫️🗜️  

Представьте большую кухню, где каждая деталь работает на ваш комфорт, а линии гарнитура сливаются в идеальный рабочий треугольник. Именно такой проект мы реализовали для семьи Виктора и Алины из Красноярска, которые хотели совместить роскошь, ',
        'photos'              => array(
            'https://sun9-59.userapi.com/s/v1/ig2/J6tg6pYOkcs1I3968_xpIhtQ8t9sEzKj1OPLAFXYLLVUXXHeK1HvD834DwL7jlY33BSGi2AIwGnOQbC-6X6wEdf4.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-72.userapi.com/s/v1/ig2/wI1M2KGAPLnH_V1L26f7m0GsKPBaqJJgNgX0KvBU_n7y3jSAfWleWNRC0-XtTQIdXUYpKrQVo3-3YXyY5u62GPAL.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-20.userapi.com/s/v1/ig2/al4WUllBsCUIxKdqzqtDu3sa3ReBGLhffrVdL9-LwBJiOT36s3KUiiuA46jDr-gHNIY28fBrpmO1Frj2LQ83-c5b.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-84.userapi.com/s/v1/ig2/6hWvGChcsszvuTyISDbr7NM3-yVJrmL3KQv8evInG62CYs-YWMR8rrknjm1AhLoYSya_37Qx7DSYM1aVQLM7Pyyk.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-84.userapi.com/s/v1/ig2/TdD1aZgrPT6z2LPLajKAWNR8VsheBwq0gzjCmzDDM_4jv40t32_a7f-q5RbpOObxbXAS5hgnfiamnA8StuakyoJG.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'project_title'       => 'Проект Монохром',
        'kitchen_title'       => 'Кухня Монохром',
        'product_id'          => 11262272,
        'project_client_name' => 'Вадим и Ольга',
        'project_area'        => '12 м²',
        'project_budget'      => '340 000 - 370 000 руб.',
        'project_duration'    => '28 дней',
        'kitchen_type_slug'   => 'uglovaya',
        'price'               => 344000,
        'description'         => '✅ Кухонный гарнитур «Монохром»: Контраст, который вдохновляет ⚫⚪  

Представьте угловую кухню, где белый матовый фон играет в дуэте с графитовыми акцентами, а подсветка добавляет магию даже в будничные вечера. Именно такой проект мы реализовали для Вадима и Ольги — пары, которая искала лаконичность,',
        'photos'              => array(
            'https://sun9-36.userapi.com/s/v1/ig2/twCFCd-yRD9o_JM7IWrqXt1uRjcLkflwA6OC3WgkWL7-v16fk_Qw9hhY6h79GlFm_lV1S1Gmw5mXRmove1huTPvJ.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-60.userapi.com/s/v1/ig2/lDEgTP_ygfxKnJgQDzluPZxtz9WFww36nL5jGcV5biZhVWKnGr1kykQetb9tB_NOKvutupYFarHjq6XFvGFG7SGm.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-27.userapi.com/s/v1/ig2/31VqIvFkSXVaDQZnonHcIwgsl6oKniiOlZr_vcmLAcOmFGs95whExy6fnKtkg0eoHuFiIc4PxRQT4Q8xlObSBhcK.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-59.userapi.com/s/v1/ig2/F45aqgZvHogPogk81ft-bRFTsw7GofdCVeuz2U78uatOJYPC-P8mbmUwDC5maTjppcCnzjLDA_j9L_z60BJda4SH.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-60.userapi.com/s/v1/ig2/NnXvGGtCWYpQMB0U3j6h0ItE69ISTx8tuQXAaLKH_ruBqLQ5G_ODOTfxSog_l9WvJZdqDYfke-NeB1COWrr8U45N.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'project_title'       => 'Проект Савора',
        'kitchen_title'       => 'Кухня Савора',
        'product_id'          => 11262888,
        'project_client_name' => 'Анна и Максим',
        'project_area'        => '12 м²',
        'project_budget'      => '340 000 - 370 000 руб.',
        'project_duration'    => '28 дней',
        'kitchen_type_slug'   => 'pryamaya',
        'price'               => 342000,
        'description'         => '✅ Кухонный гарнитур «Савора»: Контраст технологий и элегантности ⚪️🖤  
Представьте кухню, где белизна фасадов перекликается с мягким свечением стеклянного пенала, а два холодильника работают в идеальном тандеме. Именно такой проект мы создали для семьи Анны и Максима из Красноярска, которые мечтали ',
        'photos'              => array(
            'https://sun9-64.userapi.com/s/v1/ig2/NnMH96A-DiD4qe7FCCpwRDeS2baTS7WUtY6J96UXLXBb6lRsqy_GwKX0nuFDWcm73ovE-3r32H084SAgIP8G3dz7.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-67.userapi.com/s/v1/ig2/mNO7Fe_zfpm98KKDpEKTRl3V7B66DDE8_EpHfg8upQjmiXGAu9eCBXLmK8v74HpTqTw3rXEacnuhNGAgIZ8MwEKh.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-61.userapi.com/s/v1/ig2/dfYkLE-doCpCcIkvT07yZTzc-vCRLWH-QNW7dnrv8u_jdvfJJYpcRmz0eo_3ojnPJIV7DD1mpCR3WN0r0pm7K_kY.jpg?quality=95&as=32x40,48x60,72x90,108x134,160x199,240x298,360x448,480x597,540x671,640x796,720x895,1080x1343&from=bu&cs=1080x0'
        ),
    ),
    array(
        'project_title'       => 'Проект Импульс',
        'kitchen_title'       => 'Кухня Импульс',
        'product_id'          => 11262620,
        'project_client_name' => 'Алексей и Татьяна',
        'project_area'        => '12 м²',
        'project_budget'      => '320 000 - 350 000 руб.',
        'project_duration'    => '28 дней',
        'kitchen_type_slug'   => 'pryamaya',
        'price'               => 323000,
        'description'         => '✅ Кухонный гарнитур «Импульс»: Технологии и порядок в каждой детали 🌑⚙️  

Представьте прямую кухню, где графитовые фасады сливаются с техникой, а скрытые механизмы работают как часы. Именно такой проект мы сделали для семьи Алексея и Татьяны, которые хотели совместить бытовой комфорт с эстетикой со',
        'photos'              => array(
            'https://sun9-77.userapi.com/s/v1/ig2/bOjOVyU2X1_I269AHQnJdDphlfTuYy72IN2dsPNKk4itNeH19zLhVr0SyJFcu0wxf5QNJ7JKVhPhgODozVHevAry.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-84.userapi.com/s/v1/ig2/6jJuVFLKU64cxXtLgNn1iqVP8mn5ZWRymrb6aPVmu26nUfndAgs_9gY4apG8ndTuEtnAY-QCQPWA99ORJemeAnH6.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x271,480x361,540x406,640x481,720x541,1080x812&from=bu&cs=1080x0',
            'https://sun9-61.userapi.com/s/v1/ig2/wsWv91NX3x8QBBzjj_G5CDxP-LwT11i2QRN8JTHsQE5W8fOSMWxIYelUiM-ZMgZl0BQyVnQKPNmfGmcuWTt9_K5P.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x271,480x361,540x406,640x481,720x541,1080x812&from=bu&cs=1080x0',
            'https://sun9-31.userapi.com/s/v1/ig2/c6t3wlek14M4o-qilFOt-U51DU0tPpHNayg3ZreSxSJlJyQGh5Ifsmxg7PCDSbzotW0OdLSb4VbRB9-Up-h-5lqp.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x270,480x360,540x405,640x480,720x540,1080x810&from=bu&cs=1080x0',
            'https://sun9-7.userapi.com/s/v1/ig2/_dclpedDRDrMf3eh-o2kjhnI8fWQn-JI1pmeCRMjyhgBb5yKcCQnIkhdqjs4JmIVdm_zTSl6-5_oWfRIrVTbvFUI.jpg?quality=95&as=32x24,48x36,72x54,108x81,160x120,240x180,360x271,480x361,540x406,640x481,720x541,1080x812&from=bu&cs=1080x0'
        ),
    ),
    array(
        'project_title'       => 'Проект Мокко',
        'kitchen_title'       => 'Кухня Мокко',
        'product_id'          => 11262407,
        'project_client_name' => 'Виктория',
        'project_area'        => '12 м²',
        'project_budget'      => '310 000 - 340 000 руб.',
        'project_duration'    => '28 дней',
        'kitchen_type_slug'   => 'uglovaya',
        'price'               => 318000,
        'description'         => '✅ Кухонный гарнитур «Мокко»: Бюджетно, стильно, функционально ☕️⚡️  

Представьте угловую кухню, где светлые тона создают ощущение простора, а кофейные акценты добавляют уют. Именно такой проект мы реализовали для Виктории — студентки, которая искала практичное решение для своей первой кухни без пер',
        'photos'              => array(
            'https://sun9-7.userapi.com/s/v1/ig2/nKxZK8tnUnKTIXEAShu6S_lKZrsUN9M2mthteqqxQe7W695faeuspz9mmQoNaGd0J08qE7wh1U1_4gg3q-ZiCxvC.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-67.userapi.com/s/v1/ig2/9zrLosvK58k8bOW9NPEaTsaX1fJ1jPBSyNXPkjDUnE9NOoEzKL4ll5BvITCC4Rhi3bV6LIxtalNCJYzlo3d9KDXK.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-71.userapi.com/s/v1/ig2/jNMktC_LjE-_T7Ot18c5-xRExExGXfBWdnrHshyXg3lzO6TEacBU59vGUdjYZYlUhqnzPdB4mbP17inLWso6cvmI.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-68.userapi.com/s/v1/ig2/E84jasZEZbAqIw0TOTiCPf4VxwHLoV2ZpAv8YbneMSk844FKsoj0brWqYH2bslClsKHHQcyGzRzjOHBcvDI45Q2y.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-11.userapi.com/s/v1/ig2/un6uoJsF2grx4kfyPxohbak18wRJtzEnouH3opp34a69cDAk1YqFkmCe_dVd9fPCirO9d39V9Gjrb9961WmsrgqW.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0'
        ),
    ),
    array(
        'project_title'       => 'Проект Либеро',
        'kitchen_title'       => 'Кухня Либеро',
        'product_id'          => 11261959,
        'project_client_name' => 'Игорь и Алиса',
        'project_area'        => '12 м²',
        'project_budget'      => '310 000 - 340 000 руб.',
        'project_duration'    => '28 дней',
        'kitchen_type_slug'   => 'p-obraznaya',
        'price'               => 315000,
        'description'         => '✅ Кухонный гарнитур «Либеро»: Пространство, где функциональность танцует с эстетикой 🖤⚡️  

Представьте П-образную кухню, которая объединяет зону готовки, барную стойку и умное хранение в одном месте. Именно такой проект мы реализовали для семьи Игоря и Алисы, которые хотели превратить кухню в сердц',
        'photos'              => array(
            'https://sun9-37.userapi.com/s/v1/ig2/vGPSy6Emryam-5q0PM9bCnGPdsfH0BwRVrZJAwPVuHMoPKYS5W-8awcjo4bnttEsY57FZd9_64kIYEQQ-At6tZNr.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-49.userapi.com/s/v1/ig2/g__ge3l0fA1VfkDqvFBY5POjXyRKlPUZdu-dpX5hs4BNVXcKDKRBFvhtmMpT1ODpWj3Iim1u33SOnZUupzMoDFcx.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-86.userapi.com/s/v1/ig2/psAIQ8JP-3TNycE6ncbaNpjsR0F5j2AVGTThG2CVzUTyOTs5XHtcoEhRJRUf0Vd1e0t_6G8MsJ8Oh323IK39gb0Q.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-22.userapi.com/s/v1/ig2/_65vzEUuRdhdqgeQLs_dU0TWhzTv4qugZUSzYmVInTpCZnctEaLsExISm6am90Oo6dJjPFW9Ti4vuVF1qIhyEien.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-26.userapi.com/s/v1/ig2/XaeZIkeR_xAn-PLJ3Xv-4pu463EslS1lIaoTobGj5QOXQb6ZiDc5oHarXVo9rXrF60FGDxGzL_usMY2e2XhtIiZG.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'project_title'       => 'Проект Порто',
        'kitchen_title'       => 'Кухня Порто',
        'product_id'          => 11261744,
        'project_client_name' => 'Виктория',
        'project_area'        => '12 м²',
        'project_budget'      => '310 000 - 340 000 руб.',
        'project_duration'    => '28 дней',
        'kitchen_type_slug'   => 'pryamaya',
        'price'               => 312000,
        'description'         => 'Кухонный гарнитур «Порто»: Свет, стекло и безупречный ритм 🌟🖤  

Представьте кухню, где встроенная техника сливается с фасадами, а барная стойка у окна становится главным местом для утреннего кофе и вечерних встреч. Именно такую кухню мы создали для Виктории — дизайнера интерьеров, которая хотела пр',
        'photos'              => array(
            'https://sun9-36.userapi.com/s/v1/ig2/IawTYOC5uBN9yzo9FlQFERsl9dDIkTYQDXy458dcKtBhbaqsFrypZHal6VPH3uIHJbAgOal5rlnxEr4Efbhypiu4.jpg?quality=95&as=32x40,48x59,72x89,108x134,160x198,240x297,360x445,480x594,540x668,640x792,720x891,1080x1336&from=bu&cs=1080x0',
            'https://sun9-73.userapi.com/s/v1/ig2/TyAxLfw9lz0As68yZP_lnEx3oEbAzbxaio4uTTOdG12oawnoYsMofOrahtRMHpGLql1WdMDUEsLHnepC9Q3dWfVs.jpg?quality=95&as=32x40,48x59,72x89,108x134,160x198,240x297,360x445,480x594,540x668,640x792,720x891,1080x1336&from=bu&cs=1080x0',
            'https://sun9-65.userapi.com/s/v1/ig2/GUzdhft-N3WB7qllzxtDqUfwUQf8qn98lVDPgrDZFK6349cjBVwvQ347wwR0zJzpW2JgT9i-RJHMx-fjV8igZdTJ.jpg?quality=95&as=32x40,48x59,72x89,108x133,160x198,240x296,360x445,480x593,540x667,640x791,720x889,1080x1334&from=bu&cs=1080x0',
            'https://sun9-10.userapi.com/s/v1/ig2/4s3TAIU_PsWwy7YBB8xn6hxDTuQSnzcCJzYlqFBx4gVUTFWZz-Yjy7ya7dhKOuo7E2pCKVEV7-MxJKp5ansazoGh.jpg?quality=95&as=32x40,48x59,72x89,108x133,160x198,240x296,360x445,480x593,540x667,640x791,720x889,1080x1334&from=bu&cs=1080x0',
            'https://sun9-10.userapi.com/s/v1/ig2/L0WB9MkvCjoElFonHPIBlTpGsTD37G47JLiSOJ0hA-8AszAYxhujotEKb7TTY2TVkeAnTDKI2vBnLD9m8fQHgtXh.jpg?quality=95&as=32x40,48x59,72x89,108x134,160x198,240x297,360x445,480x594,540x668,640x792,720x891,1080x1336&from=bu&cs=1080x0'
        ),
    ),
    array(
        'project_title'       => 'Проект Пуэрто',
        'kitchen_title'       => 'Кухня Пуэрто',
        'product_id'          => 2355154,
        'project_client_name' => 'Марина',
        'project_area'        => '12 м²',
        'project_budget'      => '290 000 - 320 000 руб.',
        'project_duration'    => '21 день',
        'kitchen_type_slug'   => 'pryamaya',
        'price'               => 299000,
        'description'         => '✅Кухонный гарнитур «Пуэрто»: Практичность, доведённая до совершенства 🖤🔝  

Представьте кухню, где каждая деталь работает на вас: ничего лишнего, только функциональность и стиль. Именно такую кухню мы сделали для Марины — молодой мамы, которая устала от вечных пятен на столешнице и хлопающих дверок.',
        'photos'              => array(
            'https://sun9-55.userapi.com/s/v1/ig2/fU1dcsked6RNu4GOXxpt_d9NU8MrsgJ5YxHMb9jBN6PZ9Rce2h5VqpkwdZNtJwwPpzOE7GK5Oyo72d2I2zTafa_-.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-20.userapi.com/s/v1/ig2/vFodGFpBed44Ygr3Pu3ek43oIlb9D9fdfIOT7UX-hkEvSpH62LK9FdD5fAVfS2sy1P5LUYH_OHrBmfe4vBmqxXey.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-26.userapi.com/s/v1/ig2/I6lATCJjaFPAC3Hp3HiWdJFX8OuuKysCFwPVYAjdDFhmpNjX7jJwiJsFGwfFaaWR_7oUM3L_hWPiHFM5-0NyY1C6.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-43.userapi.com/s/v1/ig2/MiuWQKzwzdRcScGKKnoSyGjLaYm0Feq4T8HGy1333dQp4A9MKIqs8YBsArAqk3GH7A-DLpyyUTa2qNOdeYb5zYjC.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0',
            'https://sun9-27.userapi.com/s/v1/ig2/45GMBNCOHIzyTsdNmxSursWycqkFNkGbbYBn4eld5oP3FdWwKL3VmyoJJBNf0BqwzcOllutEzHwLMb-NXsDCo2Qh.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350&from=bu&cs=1080x0'
        ),
    ),
    array(
        'project_title'       => 'Проект Контраст',
        'kitchen_title'       => 'Кухня Контраст',
        'product_id'          => 11262347,
        'project_client_name' => 'Анна и Игорь',
        'project_area'        => '12 м²',
        'project_budget'      => '290 000 - 320 000 руб.',
        'project_duration'    => '21 день',
        'kitchen_type_slug'   => 'uglovaya',
        'price'               => 298000,
        'description'         => '✅ Кухонный гарнитур «Контраст»: Графит, белый глянец и тепло дерева ⚫️🌳  

Представьте угловую кухню, где холодный графит встречается с теплом натурального дерева, а глянцевые фасады добавляют ноту современности. Именно такой проект мы создали для Анны и Игоря — пары, которая хотела сочетать индустр',
        'photos'              => array(
            'https://sun9-19.userapi.com/s/v1/ig2/IdfSJDh41nTkGIq5E1Zvos27j6nCmNfQ_CWxwJ1vk--pd5vDQwTEiZ73lDVyMbT8bAIXaG7UbbTV4iUKn2xaKRyR.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-60.userapi.com/s/v1/ig2/oIqdnTtQsbuPL_CUtJSoNJk0KW8-Ex653RzG46FVU_v0gRFKzBJA7siwmxrGUxTs3NGAaCr_p4-7KU7umVS_o98M.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-5.userapi.com/s/v1/ig2/-5ibGKXwE000bk1NjumM9MG0I5eojdErIwSMrb4DYi6130EU9ooTs5vAbJ9Uy02gLEGriLUs6W06M0WAXZD-c2wq.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-78.userapi.com/s/v1/ig2/munP6HbMBwThk-m3Uw8WQeojqrEbTeRwE_xFwgOqPHvPED7SMtrQ4B6i8gDNuw-skW7sTLc7mLl-zj-5SbvC9lVN.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0',
            'https://sun9-57.userapi.com/s/v1/ig2/8gaoMoaPYDZlHygAfX5JOISpQatm9m3dzyvObcWpYs4ulyC4JQaCBNG3IE3Z9UJ6Y-MQ8lHhNS43cxDsoHQkwDob.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080&from=bu&cs=1080x0'
        ),
    )
);

// ---------------------------------------------------------------------------
// Main import loop
// ---------------------------------------------------------------------------
$created = 0;
$skipped = 0;
$errors  = 0;
$total   = count( $projects );

WP_CLI::log( "Starting project import: {$total} items" );
WP_CLI::log( str_repeat( '-', 60 ) );

foreach ( $projects as $index => $project ) {
    $num   = $index + 1;
    $title = $project['project_title'];

    // Check for duplicates
    $existing = get_posts( array(
        'post_type'   => 'project',
        'title'       => $title,
        'post_status' => 'any',
        'numberposts' => 1,
    ) );

    if ( ! empty( $existing ) ) {
        WP_CLI::log( "[{$num}/{$total}] SKIP (exists): {$title}" );
        $skipped++;
        continue;
    }

    // Try to find linked kitchen post
    $kitchen_post_id = find_kitchen_post_by_title( $project['kitchen_title'] );

    // Dry run output
    if ( $dry_run ) {
        $photo_count = count( $project['photos'] );
        $kitchen_link = $kitchen_post_id ? "ID {$kitchen_post_id}" : '(not found — will link after kitchen import)';
        WP_CLI::log( "[{$num}/{$total}] WOULD CREATE: {$title}" );
        WP_CLI::log( "  Client:        {$project['project_client_name']}" );
        WP_CLI::log( "  Area:          {$project['project_area']}" );
        WP_CLI::log( "  Budget:        {$project['project_budget']}" );
        WP_CLI::log( "  Duration:      {$project['project_duration']}" );
        WP_CLI::log( "  Kitchen type:  {$project['kitchen_type_slug']}" );
        WP_CLI::log( "  Kitchen link:  {$kitchen_link}" );
        WP_CLI::log( "  Photos:        {$photo_count}" );
        WP_CLI::log( '' );
        $created++;
        continue;
    }

    // Clean description for the project
    $clean_desc = project_clean_description( $project['description'] );

    // Create the post
    $post_id = wp_insert_post( array(
        'post_title'   => $title,
        'post_content' => $clean_desc,
        'post_status'  => 'publish',
        'post_type'    => 'project',
    ), true );

    if ( is_wp_error( $post_id ) ) {
        WP_CLI::warning( "[{$num}/{$total}] ERROR creating: {$title} — " . $post_id->get_error_message() );
        $errors++;
        continue;
    }

    // ACF fields
    update_field( 'project_client_name', $project['project_client_name'], $post_id );
    update_field( 'project_area', $project['project_area'], $post_id );
    update_field( 'project_budget', $project['project_budget'], $post_id );
    update_field( 'project_duration', $project['project_duration'], $post_id );

    // Link to kitchen CPT (relationship field)
    if ( $kitchen_post_id ) {
        update_field( 'project_kitchen_type', $kitchen_post_id, $post_id );
    } else {
        WP_CLI::warning( "  Kitchen post not found for: {$project['kitchen_title']} — run import-kitchens.php first" );
    }

    // Sideload gallery images
    $gallery_ids = array();
    foreach ( $project['photos'] as $photo_url ) {
        $att_id = project_sideload_image( $photo_url, $post_id, $title );
        if ( ! is_wp_error( $att_id ) ) {
            $gallery_ids[] = $att_id;
        }
    }
    // Set first image as featured
    if ( ! empty( $gallery_ids ) ) {
        set_post_thumbnail( $post_id, $gallery_ids[0] );
    }
    update_field( 'project_gallery', $gallery_ids, $post_id );

    // Assign kitchen type taxonomy if available
    if ( ! empty( $project['kitchen_type_slug'] ) ) {
        wp_set_object_terms( $post_id, $project['kitchen_type_slug'], 'kitchen_type' );
    }

    $created++;
    $photo_count = count( $gallery_ids );
    WP_CLI::success( "[{$num}/{$total}] Created: {$title} (ID {$post_id}, {$photo_count} photos)" );
}

WP_CLI::log( str_repeat( '-', 60 ) );
$mode = $dry_run ? '(DRY RUN) ' : '';
WP_CLI::success( "{$mode}Import complete: {$created} created, {$skipped} skipped, {$errors} errors" );

if ( ! $dry_run && $created > 0 ) {
    WP_CLI::log( '' );
    WP_CLI::log( 'TIP: If kitchen links show "(not found)", run import-kitchens.php first, then re-run this script.' );
}
