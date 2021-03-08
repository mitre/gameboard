$(document).ready(function () {
    let redOps = $('#red-operations').children('option').length-1;
    let blueOps = $('#blue-operations').children('option').length-1;
    if(redOps===0 && blueOps===0) {
        stream('GameBoard is only useful if a red or blue operation has been started.')
    } else {
        stream('Select red/blue operations to see what the defense detected and responded to.');
    }

    addCollapsible('facts-found-header', '#piece-fact-list');
    addCollapsible('suggested-queries-header', '#piece-queries');

});

function refresh(){
    function draw(data){
        $('#the-gameboard .gameboard-row').not(':first').remove();

        let redOpState = data.red_op_state;
        let blueOpState = data.blue_op_state;
        let exchanges = data.exchanges;
        let access = data.access;

        updateOpState('red', redOpState)
        updateOpState('blue', blueOpState);
        updatePoints(data.points);
        updateExchanges(exchanges, access);
        updateStatsTable(exchanges);

        $('.golden-goose').on('click', function () { getLinkInfo(exchanges, $(this)) })
        $('.gp-blue-pin').on('click', function() { openPinBlueLinkModal(exchanges, $(this)) })

        if (access == 'red') {
            $('.gp-blue').on('click', function() { flipGamePiece(access, $(this)) });
        }
        if (access == 'blue') {
            $('.gp-red').on('click', function() { flipGamePiece(access, $(this)) });
        }
        $('.gp-cover').on('click', function () { flipCoverPiece(access, $(this)) })
        $('.points-cover').on('click', function () { flipPointsPiece($(this)) })
        $('.points-details').on('click', function () { flipPointsPiece($(this)) })

        if (redOpState !== null || blueOpState !== null) {
            $('#gameboard-add-manual-detection-div').css('display', 'block');
        }
    }

    let redOpId = parseInt($('#red-operations option:selected').attr('value'));

    let blueOpId = parseInt($('#blue-operations option:selected').attr('value'));
    stream('Gold stars mean information was learned to help the team.');
    restRequest('POST', {'red':redOpId,'blue':blueOpId}, draw, '/plugin/gameboard/pieces');
}

function updateOpState(opType, opState) {
    if (opState) {
        let status = $('#' + opType + '-status');
        if (opState == 'running') {
            status.css('background-color', 'darkgoldenrod');
        }
        if (opState == 'finished') {
            status.css('background-color', 'green');
        }
        status.html(opState).show();
    }
}

function updatePoints(points) {
    $('#gb-red-points').text(points[0]);
    $('#gb-blue-points').text(points[1]);
}

function updateExchanges(exchanges, access) {
    exchanges.forEach(function(exchange) {
        let pid = exchange[0];
        let links = exchange[1];
        let exchangeElem = $('#exchange').clone();
        exchangeElem.attr('id', 'pid_id_' + pid);
        if (access == 'blue') {
            addGamePieces('red', exchangeElem, links['red'], pid, true);
            addGamePieces('blue', exchangeElem, links['blue'], pid, false);
        }
        else {
            addGamePieces('blue', exchangeElem, links['blue'], pid, true);
            addGamePieces('red', exchangeElem, links['red'], pid, false);
        }
        $('#exchanges').append(exchangeElem);
        exchangeElem.show();
    })
}

function addGamePieces(opType, exchangeElem, links, pid, isHidden) {
    for (let i=0; i<links.length;i++) {
        let pointsPiece = $('#points-piece').clone();
        let pointsDetails = $('#points-details').clone();
        pointsPiece.attr('id', 'piece-' + pid + '-' + opType + '-' + i + '-points');
        pointsPiece.css('transform','');
        pointsPiece.css('display', 'flex');

        pointsDetails.attr('id', 'piece-' + pid + '-' + opType + '-' + i + '-points-details');
        pointsDetails.css('transform','rotateY(180deg)');
        pointsDetails.css('display', 'flex');

        let valueSpan = pointsPiece.find('.points-value');
        let reasonSpan = pointsDetails.find('.points-reason');
        let points_value = links[i].points.value;
        let points_reason = links[i].points.reason;
        if (points_value > 0) {
            valueSpan.html('+' + points_value.toString());
            valueSpan.attr('title', points_reason);
            reasonSpan.html(points_reason);
        }
        else if (points_value < 0) {
            valueSpan.html(points_value.toString());
            valueSpan.attr('title', points_reason);
            reasonSpan.html(points_reason);
        }

        if (points_value !== 0) {
            pointsPiece.addClass('points-' + opType);
            pointsDetails.addClass('points-' + opType);
        }

        let pointsColumn = exchangeElem.find('.' + opType + '.points-delta');

        let pointsWrapper = $('#' + opType + '-wrapper').clone();
        pointsWrapper.attr('id', 'wrapper-' + pid + '-' + opType + '-' + i + '-points');
        pointsWrapper.append(pointsPiece);
        pointsWrapper.append(pointsDetails);
        pointsWrapper.show();
        pointsColumn.append(pointsWrapper);

        if (links[i].ability === undefined) {
            continue;
        }

        let coverPiece = $('#cover-piece').clone();
        coverPiece.attr('id', 'cover-' + pid + '-' + opType + '-' + i);
        coverPiece.find('.gp-ability').html(links[i].ability.name);
        coverPiece.find('.gp-tid').html(links[i].ability.technique_id)
        coverPiece.css('transform','rotateY(180deg)');
        coverPiece.css('display', 'flex');

        let gamePiece = $('#' + opType + '-piece').clone();
        gamePiece.attr('id', 'piece-' + pid + '-' + opType + '-' + i);
        gamePiece.find('.gp-ability').html(links[i].ability.name);
        gamePiece.find('.gp-time').html(links[i].finish);
        gamePiece.find('.gp-agent').html(links[i].paw);

        let goldenGoose = gamePiece.find('.golden-goose');
        if (links[i].facts.length > 0) {
            goldenGoose.attr('id', 'result_' + pid + '_' + opType + '_' + i);
            goldenGoose.find('span').html('&#11088;');
        }
        else {
            goldenGoose.attr('id', 'result_' + pid + '_' + opType + '_' + i);
            goldenGoose.find('span').html('★');
        }
        gamePiece.css('display', 'flex');

        let wrapper = $('#' + opType + '-wrapper').clone();
        wrapper.attr('id', 'wrapper-' + pid + '-' + opType + '-' + i);
        wrapper.append(coverPiece);
        wrapper.append(gamePiece);
        wrapper.show();

        let col = exchangeElem.find('.' + opType + '.gp-link');
        col.append(wrapper);

        let mid = gamePiece.closest('.gameboard-row').find('.mid');
        mid.find('.gp-pid').html(pid);
        mid.find('.gp-host').html(links[i].host);
        if (isHidden) {
            hidePieces(gamePiece, coverPiece);
        }
        else {
            mid.css('transform', '');
        }
    }
}

function hidePieces(gamePiece, coverPiece) {
    gamePiece.css('transform', 'rotateY(180deg)');
    coverPiece.css('transform', '');
    gamePiece.closest('.gameboard-row').find('.mid').css('transform', 'rotateY(180deg)');
}

function getLinkInfo(exchanges, result) {
    let id = result.attr('id').split('_');
    let exchange = findExchange(exchanges, id[1]);
    let link = exchange[id[2]][id[3]];
    document.getElementById('piece-modal').style.display='block';
    $('#piece-id').html(link['id']);
    $('#piece-ability').html(link['ability']['name']);
    $('#piece-cmd').html(atob(link['command']));
    function loadResults(data){
        $('#piece-output').html(atob(data['output']));
    }
    restRequest('POST', {'index':'result','link_id':link.id}, loadResults);
    let factList = $('#piece-fact-list');
    link['facts'].forEach(function(fact) {
        let pieceFact = divClone('#default-fact', 'piece-fact', fact.trait + ': ' + fact.value);
        factList.append(pieceFact);
    })
    if (id[2] == 'blue') {
        $('#facts-found').show();
        $('#piece-pin').val(link['pin']);
        $('#piece-pin').show();
        $('#piece-pid').hide();
        $('#pin-save').show();
    }
    else {
        $('#facts-found').hide();
        $('#piece-pin').hide();
        $('#piece-pid').html(link['pid']);
        $('#piece-pid').show();
        $('#pin-save').hide();
    }
    addSuggestedQueries(link, id[2]);
}

function findExchange(exchanges, pid) {
    for (let i=0; i<exchanges.length; i++) {
        if (exchanges[i][0] == pid) {
            return exchanges[i][1];
        }
    }
}

function flipGamePiece(access, gamePiece) {
    if (gamePiece.css('transform') == 'none') {
        gamePiece.css('transform','rotateY(180deg)');
        gamePiece.closest('.gp-wrapper').find('.gp-cover').css('transform', '');
        transformMid(access, gamePiece, 'rotateY(180deg)');
    } else {
        gamePiece.css('transform','');
        gamePiece.closest('.gp-wrapper').find('.gp-cover').css('transform', 'rotateY(180deg)');
        gamePiece.closest('.gameboard-row').find('.mid').css('transform', '');
    }
}

function flipCoverPiece(access, cover) {
    if (cover.css('transform') == 'none') {
        cover.css('transform','rotateY(180deg)');
        cover.closest('.gp-wrapper').find('.gp-red').css('transform', '');
        cover.closest('.gp-wrapper').find('.gp-blue').css('transform', '');
        transformMid(access, cover, '');
    } else {
        cover.css('transform','');
        cover.closest('.gp-wrapper').find('.gp-red').css('transform', 'rotateY(180deg)');
        cover.closest('.gp-wrapper').find('.gp-blue').css('transform', 'rotateY(180deg)');
        cover.closest('.gameboard-row').find('.mid').css('transform', 'rotateY(180deg)');
    }
}

function flipPointsPiece(piece) {
    let sibling;
    if (piece.hasClass('points-cover')) {
        sibling = piece.siblings('.points-details');
    }
    else {
        sibling = piece.siblings('.points-cover');
    }

    if (piece.css('transform') == 'none') {
        piece.css('transform','rotateY(180deg)');
        sibling.css('transform', '');
    } else {
        piece.css('transform','');
        sibling.css('transform', 'rotateY(180deg)');
    }
}

function transformMid(access, reference, transformation) {
    let mid = reference.closest('.gameboard-row').find('.mid');
    let oppositeColumn = reference.closest('.gameboard-row').find('.' + access);
    if (!oppositeColumn.is(':empty')) {
        mid.css('transform', '');
    }
    else {
        mid.css('transform', transformation);
    }
}

function resetPieceModal() {
    let modal = $('#piece-modal');
    modal.hide();
    $('#piece-cmd').empty();
    $('#piece-output').empty();
    $('#piece-fact-list').find('.piece-fact').remove();
    $('#piece-fact-list').hide();
    $('#piece-queries').find('.piece-query').remove();
    $('#piece-queries').find('.piece-query-type').remove();
    $('#piece-queries').hide();
    $('#facts-found-header').removeClass('active');
    $('#suggested-queries-header').removeClass('active');
    stream("Be sure to refresh the gameboard to update links");
}

function addSuggestedQueries(link, opType) {
    let queries = generateQueries(link, opType);
    for (var key in queries) {
        let pieceQueryType = divClone('#default-query-type', 'piece-query-type', key);
        $('#piece-queries').append(pieceQueryType);

        queries[key].forEach(function(query) {
            let pieceQuery = divClone('#default-query', 'piece-query', query);
            $('#piece-queries').append(pieceQuery);
        })
    }
}

function divClone(idToClone, divClass, htmlContent) {
    let cloned = $(idToClone).clone();
    cloned.removeAttr('id');
    cloned.addClass(divClass);
    cloned.html(htmlContent);
    cloned.show();
    return cloned;
}

function generateQueries(link, opType) {
    function generateSpecific(field, value, finish) {
        splunkQueries.push(generateSplunkQuery(field, value, finish));
        elkQueries.push(generateELKQuery(field, value));
    }

    var queries = {};
    var splunkQueries = [];
    var elkQueries = [];
    if (opType == 'blue') {
        generateSpecific('ProcessId', link.pin, link.finish);
        link['facts'].forEach(function(fact) {
            if (fact.trait == 'host.process.guid') {
                generateSpecific('ProcessGuid', '"{' + fact.value + '}"', link.finish);
            }
            if (fact.trait == 'host.process.recordid') {
                generateSpecific('RecordNumber', fact.value, link.finish);
            }
        })
    }
    else {
        generateSpecific('ProcessId', link.pid, link.finish);
        generateSpecific('CommandLine', '"*' + atob(link.command).split(' ')[0] + '*"', link.finish);
        if (link.ability.executor == 'psh') {
            generateSpecific('CommandLine', '"*powershell*"', link.finish);
        }
    }
    queries['Splunk'] = splunkQueries;
    queries['ELK'] = elkQueries;
    return queries;
}

function generateSplunkQuery(field, value, finish) {
    let earliest = incrementTime(finish, -5);
    let latest = incrementTime(finish, 5);
    return 'source="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" ' + field + '=' + value + ' earliest="' + earliest + '" latest="' + latest + '" | table _time, Image, ProcessId, CommandLine, ParentProcessId, ParentProcessGuid, ParentCommandLine, User, Computer | sort _time';
}

function incrementTime(finishTime, increment) {
    let converted = new Date(finishTime);
    converted.setSeconds(converted.getSeconds() + increment);
    return formatSplunkTime(converted);
}

function formatSplunkTime(time) {
    let month = time.getMonth() + 1;
    return month + '/' + time.getDate() + '/' + time.getFullYear() + ':' + time.toString().split(' ')[4];
}

function generateELKQuery(field, value) {
    return 'event_data.' + field + ': ' + value;
}

function updatedPin(data) {
    $('#save-pin-msg').text(data['message']).show().fadeOut(2000);
    if (data['multiple_links'] === true) {
        let links = data['links'];
        for (let i=0; i<links.length; i++) {
            let template = $("#parent-link-ability-select-template").clone();
            template.find(".parent-link-pid").val(links[i].pid);
            template.find(".link-command").text(atob(links[i].command))
            template.find(".atomic-button").on('click', function () { selectParentLinkAbility($('#pin-modal-link-id').val(), $(this)) })
            template.attr("id", "parent-link-ability-" + links[i].id);
            template.css('display', 'flex');
            if (i > 0) {
                template.css('border-top', 'solid');
                template.css('border-width', '1px');
            }
            $("#parent-links").append(template);
        }
        $("#match-parent-link-form").css('display', 'flex')
    }
}

function savePin() {
    let pin = document.getElementById('piece-pin-input');
    if (isNaN(pin.value)) {
        $('#save-pin-msg').text('Input is not a number').show().fadeOut(2000);
        return
    }

    $("#parent-links").empty();
    $("#match-parent-link-form").css('display', 'none');

    let id = document.getElementById('pin-modal-link-id');
    let is_child_pid = $('#togBtnParentChild').is(':checked');
    let host_val = $('#pin-link-host-select').val();
    let host = null
    if (host_val !== "") {
        host = host_val;
    }
    restRequest('POST', {'link_id': id.value, 'updated_pin': pin.value, 'is_child_pid': is_child_pid, 'host': host}, updatedPin, '/plugin/gameboard/pin');
    refresh();
}

function addCollapsible(header, contents) {
    let headerElem = document.getElementById(header);
    headerElem.onclick = function(){
        headerElem.classList.toggle('active');
        $(contents).slideToggle('slow');
    };
}

function verifyPopulateTechniques(parentId, tactics_and_techniques) {
    let parent = $('#'+parentId);
    $(parent).find('#technique-select').empty().append("<option disabled='disabled' selected>Choose a technique</option>");
    let tactic = $(parent).find('#tactic-select').val();
    let techniques = tactics_and_techniques[tactic];
    $.each(techniques, function(i) {
        verifyAppendTechniqueToList(parentId, tactic, techniques[i]);
    });
    alphabetize_dropdown($(parent).find('#technique-select'));
}

function verifyAppendTechniqueToList(parentId, tactic, value) {
    $('#'+parentId).find('#technique-select').append($("<option></option>")
        .attr("value", value[0])
        .data("technique", value[0])
        .text(value[0] + ' | '+ value[1]));
}

function submitVerifyDetection(parentId) {
    let parent = $('#'+parentId);
    let data = {};
    data['host'] = $(parent).find('#host-select').val();
    data['technique'] = $(parent).find('#technique-select').val();
    if ($(parent).find('#togBtnHunt').is(':checked')) {
        data['verify'] = 'guid';
    } else {
        data['verify'] = 'pid';
    }
    data['info'] = $(parent).find('#pid-entry').val();
    data['redOpId'] = parseInt($('#red-operations option:selected').attr('value'));
    data['blueOpId'] = parseInt($('#blue-operations option:selected').attr('value'));
    $(parent).find('#result-box').children().hide();
    restRequest('POST', data, verifyDetectionCallback, '/plugin/gameboard/detection');
}

function verifyDetectionCallback(data) {
    if (data['verified'] != false) {
        $('#verify-detection-modal').find('#result-correct').find('.hunt-result-txt').text(data['message']);
        $('#verify-detection-modal').find('#result-correct').fadeIn();
        $('#gameboard').find('#red-operations option[value="' + data['red_operation']['id'] + '"]').prop('selected', true).change();
        if ($('#gameboard').find('#blue-operations option[value="' + data['blue_operation']['id'] + '"]').length == 0) {
            $('#gameboard').find('#blue-operations').append('<option value="'+data['blue_operation']['id']+'">'+data['blue_operation']['name']+' - '+data['blue_operation']['start']+'</option>')
        }
        $('#gameboard').find('#blue-operations option[value="' + data['blue_operation']['id'] + '"]').prop('selected', true).change();
    } else {
        $('#verify-detection-modal').find('#result-wrong').fadeIn();
    }
}

$('#verify-detection-modal').find('#pid-entry').keyup(function(event) {
    if (event.keyCode == 13) {
        $('#verify-detection-modal').find('#submit-verify-detection').click();
    }
});

function openAnalyticModal(){
    document.getElementById('analytic-op-modal').style.display='block';
}

function resetAnalyticOpModal(){
    $('#analytic-name').val('');
    $('#analytic-query').val('');
    $('#analytic-error').html('');
    let modal = $('#analytic-op-modal');
    modal.hide();
}

function createAnalytic(){
    if (document.getElementById("analytic-name").value && document.getElementById("analytic-name").value){
        restRequest('POST', buildAnalyticData(), handleAnalyticCallback, '/plugin/gameboard/analytic');
        resetAnalyticOpModal()
    }
    else {
        $('#analytic-error').html('all fields required');
    }
}

function buildAnalyticData() {
    let name = document.getElementById("analytic-name").value;
    let query = document.getElementById("analytic-query").value;
    return {'name': name, 'query': query};
}

function handleAnalyticCallback(data){
    stream('Operation started, just wait a minute to see results.');
}

function openPinBlueLinkModal(exchanges, elem){
    let piece = $(elem).parent();
    let modal = $("#pin-blue-link-modal");
    $(modal).find("#pin-blue-link-modal-link-name").text($(piece).find(".gp-ability").text());
    $(modal).css('display', 'block');

    let id = $(piece).attr('id').split('-');
    let exchange = findExchange(exchanges, id[1]);
    let link = exchange[id[2]][id[3]];
    $('#pin-modal-link-id').val(link['id']);
}

function toggleParentChild() {
    if ($('#togBtnParentChild').is(':checked')) {
        $('#pin-link-host-select').css('display', 'block');
    } else {
        $('#pin-link-host-select').css('display', 'none');
    }
}

function selectParentLinkAbility(child_link_id, button) {
    function selectParentLinkAbilityCallback(data) {
        $("#parent-links").empty();
        $("#match-parent-link-form").css('display', 'none');
        $('#save-pin-msg').text(data['message']).show().fadeOut(2000);
    }

    let parent_link_pid = $(button).parent().find(".parent-link-pid").val();
    restRequest('POST', {'link_id': child_link_id, 'updated_pin': parent_link_pid, 'is_child_pid': false}, selectParentLinkAbilityCallback, '/plugin/gameboard/pin');
    refresh();
}

function updateStatsTable(exchanges){
    let true_pos = 0;
    let false_pos = 0;
    let false_neg = 0;
    exchanges.forEach(function(exchange) {
        if (exchange[1]['red'].length === 0) {
            false_pos += exchange[1]['blue'].length;
        } else if (exchange[1]['blue'].length === 0) {
            false_neg += exchange[1]['red'].length;
        } else {
            true_pos += exchange[1]['blue'].length;
        }
    });
    let total = true_pos + false_pos + false_neg;
    $("#gb-stats-table-true td:nth-child(2)").text((true_pos/total)*100 + '%');
    $("#gb-stats-table-false td:nth-child(2)").text((false_pos/total)*100 + '%');
    $("#gb-stats-table-false td:nth-child(3)").text((false_neg/total)*100 + '%');
}