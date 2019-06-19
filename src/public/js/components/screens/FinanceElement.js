import { Map as ImmutableMap, List, Set as ImmutableSet } from 'immutable';

import React from 'react';
import { connect } from 'react-redux';

import page from 'page';

import { max } from 'd3-array';

import {makeLigneBudgetId}  from '../../../../shared/js/finance/DocBudgDataStructures';
import {aggregatedDocumentBudgetaireNodeTotal, aggregatedDocumentBudgetaireNodeElements} from '../../../../shared/js/finance/AggregationDataStructures.js'
import {hierarchicalM52}  from '../../../../shared/js/finance/memoized';
import {makeChildToParent, flattenTree} from '../../../../shared/js/finance/visitHierarchical.js';

import { DF, DI } from '../../../../shared/js/finance/constants';

import {fonctionLabels, natureLabels} from '../../../../../build/finances/m52-strings.json';

import StackChart from '../../../../shared/js/components/StackChart';
import {makeAmountString, default as MoneyAmount} from '../../../../shared/js/components/MoneyAmount';

import PageTitle from '../../../../shared/js/components/gironde.fr/PageTitle';
import SecundaryTitle from '../../../../shared/js/components/gironde.fr/SecundaryTitle';
import DownloadSection from '../../../../shared/js/components/gironde.fr/DownloadSection';

import {CHANGE_EXPLORATION_YEAR} from '../../constants/actions';

import colorClassById from '../../colorClassById';

import FinanceElementContext from '../FinanceElementContext';
import RollingNumber from '../RollingNumber';

/*
    In this component, there are several usages of dangerouslySetInnerHTML.

    In the context of the public dataviz project, the strings being used are HTML generated by
    a markdown parser+renderer. This part is considered trusted enough.

    The content being passed to the markdown parser is created and reviewed by the project team and likely
    by the communication team at the Département de la Gironde. So this content is very very unlikely to ever
    contain anything that could cause any harm.

    For these reasons, the usages of dangerouslySetInnerHTML are fine.
*/



/*

interface FinanceElementProps{
    contentId: string,
    amount, // amount of this element
    aboveTotal, // amount of the element in the above category
    topTotal // amount of total expenditures or revenue
    texts: FinanceElementTextsRecord,

    // the partition will be displayed in the order it's passed. Sort beforehand if necessary
    partition: Array<{
        contentId: string,
        partAmount: number,
        texts: FinanceElementTextsRecord,
        url: stringMarkdown
    }>
}

*/


export function FinanceElement({contentId, RDFI, amountByYear, contextElements, texts, partitionByYear, year, m52Rows, changeExplorationYear, screenWidth}) {
    const label = texts && texts.label || '';
    const atemporalText = texts && texts.atemporal;
    const temporalText = texts && texts.temporal;

    const amount = amountByYear.get(year);

    const years = partitionByYear.keySeq().toJS();

    // sort all partitions part according to the order of the last year partition
    let lastYearPartition = partitionByYear.get(max(years))
    lastYearPartition = lastYearPartition && lastYearPartition.sort((p1, p2) => p2.partAmount - p1.partAmount);
    const partitionIdsInOrder = lastYearPartition && lastYearPartition.map(p => p.contentId) || [];

    // reorder all partitions so they adhere to partitionIdsInOrder
    partitionByYear = partitionByYear.map(partition => {
        // indexOf inside a .map leads to O(n^2), but lists are 10 elements long max, so it's ok
        return partition && partition.sort((p1, p2) => partitionIdsInOrder.indexOf(p1.contentId) - partitionIdsInOrder.indexOf(p2.contentId))
    })

    let thisYearPartition = partitionByYear.get(year);

    let barchartPartitionByYear = partitionByYear;
    if(contentId === 'DF'){
        // For DF, for the split thing at the end, the whole partition is needed.
        // However, DF.1 === DF.2, so for the barchart, we only want one of them with the label "solidarité"
        barchartPartitionByYear = barchartPartitionByYear.map(partition => {
            partition = partition.remove(partition.findIndex(p => p.contentId === 'DF.1'))

            const df2 = partition.find(p => p.contentId === 'DF.2');

            return partition.set(partition.findIndex(p => p.contentId === 'DF.2'), {
                contentId: df2.contentId,
                partAmount: df2.partAmount,
                texts: df2.texts && df2.texts.set('label', [
                    'Actions sociales ',
                    React.createElement('a', {href: '#!/finance-details/DF.1'}, '(par prestation)'),
                    ' - ',
                    React.createElement('a', {href: '#!/finance-details/DF.2'}, '(par public)')
                ]),
                url: undefined
            });
        })

        // temporarily don't display DF.1
        thisYearPartition = thisYearPartition && thisYearPartition.remove(
            thisYearPartition.findIndex(p => p.contentId === 'DF.1')
        )
    }

    const legendItemIds = barchartPartitionByYear
    .map(partition => partition.map(part => part.contentId).toSet())
    .toSet().flatten().toArray()
    .sort( (lid1, lid2) => {
        return partitionIdsInOrder.indexOf(lid1) - partitionIdsInOrder.indexOf(lid2)
    } );

    const legendItems = legendItemIds.map(id => {
        let found;

        barchartPartitionByYear.find(partition => {
            found = partition.find(p => p.contentId === id )
            return found;
        })

        return {
            id: found.contentId,
            className: found.contentId,
            url: found.url,
            text: found.texts && found.texts.label,
            colorClassName: colorClassById.get(found.contentId)
        }
    });



    const RDFIText = RDFI === DF ?
        'Dépense de fonctionnement' :
        RDFI === DI ?
            `Dépense d'investissement`:
            '';

    const isLeaf = !(thisYearPartition && thisYearPartition.size >= 2);

    return React.createElement('article', {className: 'finance-element'},
        React.createElement(PageTitle, {text: RDFI ?
            `${RDFIText} - ${label} en ${year}` :
            `${label} en ${year}`}),
        React.createElement('section', {},
            React.createElement('div', {className: 'top-infos'},
                contextElements ? React.createElement(FinanceElementContext, { contextElements }) : undefined,
                React.createElement('div', {},
                    React.createElement('h2', {}, React.createElement(RollingNumber, {amount})),
                    atemporalText ? React.createElement('div', {className: 'atemporal', dangerouslySetInnerHTML: {__html: atemporalText}}) : undefined
                )
            )
        ),

        React.createElement('section', {},
            React.createElement(SecundaryTitle, {text: 'Évolution sur ces dernières années'}),
            temporalText ? React.createElement('div', {className: 'temporal', dangerouslySetInnerHTML: {__html: temporalText}}) : undefined,
            React.createElement(StackChart, {
                WIDTH: screenWidth >= 800 + 80 ?
                    800 :
                    (screenWidth - 85 >= 600 ? screenWidth - 85 : (
                        screenWidth <= 600 ? screenWidth - 10 : 600
                    )),
                portrait: screenWidth <= 600,
                xs: years,
                ysByX: barchartPartitionByYear.map(partition => partition.map(part => part.partAmount)),
                selectedX: year,
                onSelectedXAxisItem: changeExplorationYear,
                onBrickClicked: !isLeaf ? (year, id) => {
                    const url = barchartPartitionByYear.get(year).find(e => e.contentId === id).url;
                    page(url);
                } : undefined,
                legendItems: !isLeaf ? legendItems : undefined,
                uniqueColorClass: isLeaf ? colorClassById.get(contentId) : undefined,
                yValueDisplay: makeAmountString
            })
        ),

        isLeaf && m52Rows ? React.createElement('section', { className: 'raw-data'},
            React.createElement(SecundaryTitle, {text: `Consultez ces données en détail à la norme comptable M52 pour l'année ${year}`}),
            React.createElement('table', {},
                React.createElement('thead', {},
                    React.createElement('tr', {},
                        React.createElement('th', {}, 'Fonction'),
                        React.createElement('th', {}, 'Nature'),
                        React.createElement('th', {}, 'Montant')
                    )
                ),
                React.createElement('tbody', {},
                    m52Rows
                    .sort((r1, r2) => r2['MtReal'] - r1['MtReal'])
                    .map(row => {
                        return React.createElement('tr', {title: makeLigneBudgetId(row)},
                            React.createElement('td', {}, fonctionLabels[row['Fonction']]),
                            React.createElement('td', {}, natureLabels[row['Nature']]),
                            React.createElement('td', {},
                                React.createElement(MoneyAmount, {amount: row['MtReal']})
                            )
                        )
                    })
                )
            ),
            React.createElement(
                DownloadSection,
                {
                    title: `Données brutes sur datalocale.fr`,
                    items: [
                        {
                            text: 'Comptes administratifs du Département de la Gironde au format TOTEM',
                            url: 'https://www.datalocale.fr/dataset/comptes-administratifs-budget-principal-donnees-budgetaires-du-departement-de-la-gironde1'
                        }
                    ]
                }
            )
        ) : undefined

    );
}



export function makePartition(element, totalById, textsById, possibleChildrenIds){
    if(!element){
        return new List();
    }

    let children = element.children;
    children = children && typeof children.toList === 'function' ? children.toList() : children;

    if(!possibleChildrenIds){
        possibleChildrenIds = children.map(c => c.id);
    }

    return children && (children.size >= 1 || children.length >= 1) ?
        possibleChildrenIds.map(id => {
            // .find over all possibleChildrenIds is O(n²), but n is small (<= 10)
            const child = children.find(c => c.id === id);

            return {
                contentId: id,
                partAmount: child ? totalById.get(child.id) : 0,
                texts: textsById.get(id),
                url: `#!/finance-details/${id}`
            };
        }) :
        List().push({
            contentId: element.id,
            partAmount: totalById.get(element.id),
            texts: textsById.get(element.id),
            url: `#!/finance-details/${element.id}`
        });
}



export function makeElementById(aggregated, hierM52){
    let elementById = new ImmutableMap();

    flattenTree(aggregated).forEach(aggNode => {
        elementById = elementById.set(aggNode.id, aggNode);
    });

    if(hierM52){
        flattenTree(hierM52).forEach(m52HierNode => {
            elementById = elementById.set(m52HierNode.id, m52HierNode);
        });
    }

    return elementById;
}



function makeContextList(element, childToParent){
    let contextList = [];
    let next = element;

    while(next){
        contextList.push(next);
        next = childToParent.get(next);
    }

    contextList = contextList
    // furtherest context first
    .reverse()
    // remove TOTAL
    .slice(1);

    if(contextList.length > 4){
        const [c1, c2, c3] = contextList;
        const [last] = contextList.slice(-1);

        contextList = [c1, c2, c3, last];
    }

    return contextList;
}


export default connect(
    state => {
        const { docBudgByYear, aggregationByYear, planDeCompteByYear, textsById, financeDetailId, explorationYear, screenWidth } = state;

        const isM52Element = financeDetailId.startsWith('M52-');

        let RDFI;
        if(isM52Element){
            RDFI = contentId.slice('M52-'.length, 'M52-XX'.length);
        }

        const documentBudgetaire = docBudgByYear.get(explorationYear);
        const aggregatedDocumentBudgetaire = aggregationByYear.get(explorationYear);
        const planDeCompte = planDeCompteByYear.get(explorationYear)

        const hierM52 = documentBudgetaire && RDFI && planDeCompte && hierarchicalM52(documentBudgetaire, planDeCompte, RDFI);

        const childToParent = makeChildToParent(...[aggregatedDocumentBudgetaire, hierM52].filter(x => x !== undefined))

        const displayedContentId = financeDetailId;

        const elementById = (documentBudgetaire && makeElementById(aggregatedDocumentBudgetaire, hierM52)) || new ImmutableMap();
        const element = elementById.get(displayedContentId);

        const contextList = makeContextList(element, childToParent);

        const elementByIdByYear = docBudgByYear.map((m52i, year) => {
            return makeElementById(
                aggregationByYear.get(year),
                RDFI ? hierarchicalM52(m52i, planDeCompteByYear.get(year), RDFI) : undefined
            );
        });

        const displayedElementByYear = elementByIdByYear.map(elementById => {
            return elementById.get(displayedContentId);
        })

        // Depending on the year, all elements may not have the same children ids.
        // This is the set of all possible ids for the given years
        const displayedElementPossibleChildrenIds = displayedElementByYear.map(element => {
            if(!element)
                return new ImmutableSet();

            let children = element.children;
            children = children && typeof children.toList === 'function' ? children.toList() : children;

            if(!children)
                return new ImmutableSet();

            return new ImmutableSet(children).map(child => child.id);
        }).toSet().flatten().toList();

        const partitionByYear = elementByIdByYear.map((elementById) => {
            const yearElement = elementById.get(displayedContentId);

            return makePartition(yearElement, elementById.map(e => e.total || aggregatedDocumentBudgetaireNodeTotal(e)), textsById, displayedElementPossibleChildrenIds)
        });

        const amountByYear = elementByIdByYear.map((elementById) => {
            const yearElement = elementById.get(displayedContentId);

            return yearElement && yearElement.total || aggregatedDocumentBudgetaireNodeTotal(yearElement);
        });

        const m52Rows = element && (!element.children || element.children.size === 0 || element.children.length === 0) ?
            (isM52Element ? element.elements : aggregatedDocumentBudgetaireNodeElements(element) ) :
            undefined;

        const texts = textsById.get(displayedContentId);

        return {
            contentId: displayedContentId,
            RDFI,
            amountByYear,
            contextElements: contextList.map((c, i) => {
                const rdTotal = contextList[0].total || aggregatedDocumentBudgetaireNodeTotal(contextList[0])
                const total = c.total || aggregatedDocumentBudgetaireNodeTotal(c)

                return ({
                    id: c.id,
                    url : c.id !== displayedContentId ? '#!/finance-details/'+c.id : undefined,
                    proportion : total/rdTotal,
                    colorClass : colorClassById.get(c.id),
                    label: textsById.get(c.id).label +
                        (contextList.length >= 2 && i === contextList.length -1 ?
                            ` (${(total*100/rdTotal).toFixed(1)}%)` :
                            '')
                })
            }),
            texts,
            partitionByYear,
            m52Rows,
            year: explorationYear,
            screenWidth
        }

    },
    dispatch => ({
        changeExplorationYear(year){
            dispatch({
                type: CHANGE_EXPLORATION_YEAR,
                year
            })
        }
    })
)(FinanceElement);
