
{
    const factor = 2;
    const atlas_icon = 78/factor;
    const connection_offset = atlas_icon/2;
    // These are needed if the atlas is cut down in size. Offsets from top left corner
    const offset_x = 0;
    const offset_y = 0;
    
    let ctx;
    
    let data = {};
    let regions = {
        ['InsideBottomLeft']: {
            'x': 1620-offset_x,
            'y': 1840-offset_y,
        },
        ['InsideBottomRight']: {
            'x': 1975-offset_x,
            'y': 1770-offset_y,
        },
        ['InsideTopLeft']: {
            'x': 1685-offset_x,
            'y': 370-offset_y,
        },
        ['InsideTopRight']: {
            'x': 2250-offset_x,
            'y': 340-offset_y,
        },
        ['OutsideBottomLeft']: {
            'x': 870-offset_x,
            'y': 1980-offset_y,
        },
        ['OutsideBottomRight']: {
            'x': 3000-offset_x,
            'y': 1970-offset_y,
        },
        ['OutsideTopLeft']: {
            'x': 640-offset_x,
            'y': 260-offset_y,
        },
        ['OutsideTopRight']: {
            'x': 2900-offset_x,
            'y': 260-offset_y,
        },
    };
    
    function atlas_init() {
        $('.map_container').remove();
        ctx = $('#atlas_of_worlds')[0].getContext("2d");
        ctx.font = "bold 16px Arial";
        ctx.textAlign = 'center';
        
        var i = 1;
        $('.atlas_of_worlds').find('.regions').find('tbody').find('tr').each(function (index) {
            var id = $(this).find('.field_id')[0].textContent;
            var name = $(this).find('.field_name')[0].textContent;
            
            // initalize region fields
            regions[id]['level'] = 0;
            regions[id]['name'] = name;
            regions[id]['maps'] = [];
            regions[id]['items'] = {};
            
            var x = regions[id]['x'];
            var y = regions[id]['y'];
            $('#atlas_of_worlds').after(`<button id="${id}" class="region_button" onclick="region_button(this)" data-level="0" style="top: ${y}px;left: ${x}px;">${name} (0)</button>`);
            var i = i + 1;
        });
        
        $('.atlas_of_worlds').find('.drops').find('tbody').find('tr').each(function (index) {
            var region_id = $(this).find('.field_region_id')[0].textContent;
            var pg = $(this).find('.field__pageName')[0].textContent;
            var min = Number($(this).find('.field_tier_min')[0].textContent);
            var max = Number($(this).find('.field_tier_max')[0].textContent);
            
            if (typeof regions[region_id]['items'][pg] === 'undefined') {
                var name = $(this).find('.field_name')[0].textContent;
                var img = $(this).find('.field_icon').find('img')[0].outerHTML;
                regions[region_id]['items'][pg] = {
                    ['min']: min,
                    ['max']: max,
                    ['html']: `<div class="map_drop"><a href="/${pg}">${name}<br>${img}</a></div>`,
                };
            } else {
                regions[region_id]['items'][pg]['min'] = Math.min(min, regions[region_id]['items'][pg]['min']);
                regions[region_id]['items'][pg]['max'] = Math.max(max, regions[region_id]['items'][pg]['max']);
            }
        });
        
        $('.atlas_of_worlds').find('.items').find('tbody').find('tr').each(function (index) {
            var tr = $(this);
            var pg = $(this).find('.field__pageName')[0].textContent;
            
            
            var map_name = $(this).find('.field_name')[0].textContent;
            var html = $(`<div class="map_container"><div class="map_name">${map_name}</div><div class="map_icon"><a href="/${pg}"></a></div><div class="map_tier"></div><div class="map_drop_container"></div></div>`);
            ['low_tier', 'mid_tier', 'high_tier'].forEach(function (value) {
                var ico = tr.find('.field_icon_' + value).find('img');
                ico.addClass(value);
                html.find('.map_icon').find('a').append(ico);
            });
            
            var current = {
                ['region_id']: $(this).find('.field_region_id')[0].textContent,
            };
            
            for (var i = 0; i<=4; i++) {
                current['tier' + i] = Number($(this).find('.field_map_tier' + i)[0].textContent);
                current['x' + i] = Number($(this).find('.field_x' + i)[0].textContent)*4;
                current['y' + i] = Number($(this).find('.field_y' + i)[0].textContent)*4;
                current['connections' + i] = [];
            }
            
            for (const [page, item_data] of Object.entries(regions[current['region_id']]['items'])) {
                html.find('.map_drop_container').append($(item_data['html']));
            }
            
            $('#atlas_of_worlds').after(html);
            current['html'] = html;
            
            data[pg] = current;
            
            regions[current['region_id']]['maps'].push(pg);
        });
        
        $('.atlas_of_worlds').find('.connections').find('tbody').find('tr').each(function (index) {
            var source = $(this).find('.field_map1')[0].textContent;
            var target = $(this).find('.field_map2')[0].textContent;
            if (typeof data[source] !== 'undefined' && typeof data[target] !== 'undefined') {
                for (var i = 0; i<=4; i++) {
                    if ($(this).find('.field_region' + i)[0].textContent == 'Yes') {
                        data[source]['connections' + i].push(target);
                        data[target]['connections' + i].push(source);
                    }
                }
            }
        });
        
        atlas_update();
    }
    
    function region_button(btn) {
        btn = $(btn);
        var id = btn.attr('id');
        var region_level = Number(btn.data('level'));
        
        if (region_level == 4) {
            region_level = 0;
        } else {
            region_level = region_level + 1;
        }
        
        btn.data('level', region_level);
        regions[id].level = region_level;
        
        var name = regions[id]['name'];
        btn.html(`${name} (${region_level})`); 
        
        atlas_update();
    }
    
    function atlas_update() {
        ctx.clearRect(0, 0, 5000, 5000);
        
        // Draw connections first so they don't overlap the icons or text 
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'black';
        for (const [page, current] of Object.entries(data)) {
            var region_level = regions[current.region_id].level;
            var tier = current['tier' + region_level];
            if (tier > 0) {
                var x = current['x' + region_level];
                var y = current['y' + region_level];
                for (const target_name of current['connections' + region_level]) {
                    var target = data[target_name];
                    var target_level = regions[target['region_id']]['level'];
                    
                    ctx.beginPath();
                    ctx.moveTo(x+connection_offset, y);
                    ctx.lineTo(target['x' + target_level]+connection_offset, target['y' + target_level]);
                    ctx.stroke();
                }
            }
        }
        
        ctx.strokeStyle = 'black';
        for (const [page, current] of Object.entries(data)) {
            var region_level = regions[current.region_id].level;
            var tier = current['tier' + region_level];
            if (tier > 0) {
                var x = current['x' + region_level];
                var y = current['y' + region_level];
                
                current['html'].css('left', x);
                current['html'].css('top', y);
                current['html'].css('display', 'block');
                
                current['html'].removeClass('low_tier');
                current['html'].removeClass('mid_tier');
                current['html'].removeClass('high_tier');
                if (tier <= 5) {
                    current['html'].addClass('low_tier');
                } else if (tier <= 10) {
                    current['html'].addClass('mid_tier');
                    //ctx.fillStyle = 'rgb(255,210,100)';
                } else {
                    current['html'].addClass('high_tier');
                    //ctx.fillStyle = 'rgb(240,30,10)';
                }
    
                current['html'].find('.map_tier').text(tier);
                
                for (const [item_page, item_data] of Object.entries(regions[current.region_id]['items'])) {
                    var item_html = current['html'].find('.map_drop_container').find(`a[href='/${item_page}']`);
                    if (tier >= item_data['min'] && tier <= item_data['max']) {
                        item_html.css('display', 'block');
                    } else {
                        item_html.css('display', 'none');
                    }
                }
            } else {
                current['html'].css('display', 'none');
            }
        }
    }
    
    window.addEventListener('load', atlas_init);
    }