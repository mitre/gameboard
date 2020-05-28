$(document).ready(function () {
    let redOps = $('#red-operations').children('option').length-1;
    let blueOps = $('#blue-operations').children('option').length-1;
    if(redOps===0 && blueOps===0) {
        stream('GameBoard is only useful if a red or blue operation has been started.')
    } else {
        stream('Select red/blue operations to see what the defense detected and responded to.');
    }
});

function refresh(){
    function draw(data){
        $('#the-gameboard .gameboard-row').not(':first').remove();

        let redOp = data.red_op;
        let blueOp = data.blue_op;
        let exchanges = data.exchanges;
        let access = data.access;

        updateOpState('red', redOp)
        updateOpState('blue', blueOp);
        updatePoints(exchanges);
        updateExchanges(exchanges, access);

        $('.golden-goose').on('click', function () { getLinkInfo(exchanges, $(this)) })

        if (access == 'red') {
            $('.gp-blue').on('click', function() { flipGamePiece(access, $(this)) });
        }
        if (access == 'blue') {
            $('.gp-red').on('click', function() { flipGamePiece(access, $(this)) });
        }
        $('.gp-cover').on('click', function () { flipCoverPiece(access, $(this)) })

    }
    let redOpId = parseInt($('#red-operations option:selected').attr('value'));
    let blueOpId = parseInt($('#blue-operations option:selected').attr('value'));
    stream('Gold stars mean information was learned to help the team.');
    restRequest('POST', {'red':redOpId,'blue':blueOpId}, draw, '/plugin/gameboard/pieces');
}

function updateOpState(opType, op) {
    if (op) {
        let status = $('#' + opType + '-status');
        if (op.state == 'running') {
            status.css('background-color', 'darkgoldenrod');
        }
        if (op.state == 'finished') {
            status.css('background-color', 'green');
        }
        status.html(op.state).show();
    }
}

function updatePoints(exchanges) {
    function handOutPoints(opType, links) {
        let points = 0;
        links.forEach(function(link) {
            if(opType == 'red') {
                points += handOutRedPoints(link);
            }
            else {
                points += handOutBluePoints(link);
            }
        })
        return points;
    }

    let redPoints = 0;
    let bluePoints = 0;
    exchanges.forEach(function(exchange) {
        let links = exchange[1];
        redPoints += handOutPoints('red', links['red']);
        bluePoints += handOutPoints('blue', links['blue']);
    })
    $('#gb-blue-points').text(bluePoints);
    $('#gb-red-points').text(redPoints);
}

function handOutBluePoints(link) {
    let points = 0;
    if(link.facts.length == 0) {
        points -= 1;
        return points;
    }
    if(link.ability.tactic === 'response') {
        points += 2;
    }
    return points;
}

function handOutRedPoints(link){
    let points = 0;
    if(link.status !== 0) {
        points -= 1;
        return points;
    }
    if(link.ability.tactic === 'credential-access') {
        points += 3;
    } else if(link.ability.tactic === 'collection') {
        points += 2;
    } else if (link.ability.tactic === 'impact') {
        points +=3;
    } else if (link.ability.tactic === 'lateral-movement') {
        points +=5;
    } else if (link.ability.tactic === 'exfiltration') {
        points +=3;
    } else if (link.ability.tactic === 'defense-evasion') {
        points +=4;
    } else if (link.ability.tactic === 'persistence') {
        points +=6;
    } else if (link.ability.tactic === 'privilege-escalation') {
        points +=3;
    } else {
        points += 1;
    }
    return points;
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

        let col = exchangeElem.find('.' + opType);
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
    $('#piece-cmd').html(atob(link['command']));
    let factList = $('#piece-fact-list');
    link['facts'].forEach(function(fact) {
        let pieceFact = divClone('#default-fact', 'piece-fact', fact.trait + ': ' + fact.value);
        factList.append(pieceFact);
    })
    if (id[2] == 'blue') {
        $('#facts-found').show();
    }
    else {
        $('#facts-found').hide();
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
    $('#piece-queries').find('.piece-query').remove();
    $('#piece-queries').find('.piece-query-type').remove();
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
