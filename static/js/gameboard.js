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

        $('.golden-goose').on('click', function () { getLinkInfo(exchanges, $(this)) })

        if (access == 'red') {
            $('.gp-blue').on('click', function() { flipGamePiece(access, $(this)) });
        }
        if (access == 'blue') {
            $('.gp-red').on('click', function() { flipGamePiece(access, $(this)) });
        }
        $('.gp-cover').on('click', function () { flipCoverPiece(access, $(this)) })
        $('.points-cover').on('click', function () { flipPointsPiece($(this)) })
        $('.points-details').on('click', function () { flipPointsPiece($(this)) })

        //TODO: move the below section into if statement for hidden red ops only!!
        let open_verify_modal = '<br><br><div id="open-verify-modal" onclick="document.getElementById(\'verify-detection-modal\').style.display=\'block\'">+ Add External Detection</div>'
        if ($('#the-gameboard').find('#exchanges').find('.gameboard-row').length == 0) {
            let new_row = $('#exchange').clone();
            $(new_row).attr('id', 'empty-row');
            $('#the-gameboard').find('#exchanges').append(new_row);
        }
        let last_row = $('#the-gameboard').find('#exchanges').find('.gameboard-row').last();
        let blue_col = $(last_row).find('.gameboard-column.blue.gp-link').append(open_verify_modal);

    }
    let redOpId = parseInt($('#red-operations option:selected').attr('value'));
    if ($('#red-operations option[value="hidden"]').length > 0 && $('#red-operations option:selected').index() > $('#red-operations option[value="hidden"]').index()) {
        $('#blue-operations option:selected').prop('selected', false);
        $('#blue-operations :nth-child(0)').prop('selected', true);
        $('#blue-operations').prop('disabled', 'disabled');
    } else {
        $('#blue-operations').prop('disabled', false);
    }

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
        if (links[i].hasOwnProperty('hidden')){
            gamePiece.css('background-color', 'rgba(255, 255, 255, 0.1)')
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
        if (isHidden && !(links[i].hasOwnProperty('hidden'))) {
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

function savePin() {
    function updatedPin() {
        $('#save-pin-msg').text('Saved!').show().fadeOut(2000);
    }
    let pin = document.getElementById('piece-pin');
    if (isNaN(pin.value)) {
        $('#save-pin-msg').text('Input is not a number').show().fadeOut(2000);
        return
    }
    let id = document.getElementById('piece-id');
    restRequest('PUT', {'link_id': id.innerHTML, 'updated_pin': pin.value}, updatedPin, '/plugin/gameboard/pin');
}

function addCollapsible(header, contents) {
    let headerElem = document.getElementById(header);
    headerElem.onclick = function(){
        headerElem.classList.toggle('active');
        $(contents).slideToggle('slow');
    };
}

$('#hidden-operations-header').click(function() {
    if ($('#hidden-operations-contents').css('display') == 'none') {
       $('#hidden-operations-header').text('- Create Hidden Operation');
    } else {
        $('#hidden-operations-header').text('+ Create Hidden Operation');
    }
    $('#hidden-operations-contents').slideToggle();
});

function handleHiddenStartAction() {
    let data = {};
    data['op_name'] = $('#hiddenOpName').val();
    data['group'] = $('#hiddenOpGroup').val();
    data['profile'] = $('#hiddenOpProfile').val();
    restRequest('POST', data, handleHiddenStartActionCallback, '/plugin/gameboard/hidden');
}

function handleHiddenStartActionCallback(data) {
    if (data.hidden_red_operation.length > 0) {
        let op = data.hidden_red_operation[0];
        if ($('#gameboard').find('#red-operations option[value="hidden"]').length == 0) {
            $('#gameboard').find('#red-operations').append('<option value="hidden" disabled>Hidden operations</option>');
        }
        $('#gameboard').find('#red-operations').append('<option value="'+op.id+'">'+op.name+' - '+op.start+'</option>');
        $('#gameboard').find('#hiddenOpReturnStatus').text('Hidden operation "'+op.name+'" created');
    } else {
        $('#gameboard').find('#hiddenOpReturnStatus').text('Hidden operation failed to create');
    }
    $('#gameboard').find('#hiddenOpReturnStatus').fadeIn();
    setTimeout(function() {
        $('#gameboard').find('#hiddenOpReturnStatus').fadeOut();
    }, 3000);
}

function validateHiddenOpStart() {
    let name = $('#gameboard').find('#hiddenOpName').val();
    let group = $('#gameboard').find('#hiddenOpGroup').val();
    let profile = $('#gameboard').find('#hiddenOpProfile').val();
    if (name == null || name == "" || group == null || group == "" || profile == null || profile == "") {
        $('#gameboard').find('#HdnOpBtn').css('opacity', 0.5);
        $('#gameboard').find('#HdnOpBtn').attr('disabled', 'true');
        $('#gameboard').find('#HdnOpBtn').removeClass('button-success');
        $('#gameboard').find('#HdnOpBtn').addClass('button-notready');
    } else {
        $('#gameboard').find('#HdnOpBtn').css('opacity', 1);
        $('#gameboard').find('#HdnOpBtn').removeAttr('disabled');
        $('#gameboard').find('#HdnOpBtn').removeClass('button-notready');
        $('#gameboard').find('#HdnOpBtn').addClass('button-success');
    }
}
